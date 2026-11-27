package controller

import (
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/jsplugin"
	"github.com/uter-ai/uter/service"
)

// reconcileUpstreamMonitorOnce guarantees the channel↔monitor backfill runs at
// most once per process on the first task-list read.
var reconcileUpstreamMonitorOnce sync.Once

type upstreamMonitorTaskRequest struct {
	Name                string   `json:"name" binding:"required,max=128"`
	ChannelID           int      `json:"channel_id"`
	ChannelGroup        string   `json:"channel_group" binding:"omitempty,max=64"`
	ChannelKeyIndex     int      `json:"channel_key_index"`
	BaseURL             string   `json:"base_url" binding:"omitempty,max=512"`
	APIKey              string   `json:"api_key"`
	Model               string   `json:"model" binding:"omitempty,max=256"`
	Models              []string `json:"models"`
	Protocol            string   `json:"protocol" binding:"required,oneof=openai anthropic"`
	CheckIntervalMinute int      `json:"check_interval_minute" binding:"required,min=1,max=10080"`
	ProbeDepth          string   `json:"probe_depth" binding:"omitempty,oneof=quick standard full"`
	Enabled             *bool    `json:"enabled"`
}

type upstreamMonitorModelsRequest struct {
	BaseURL    string `json:"base_url" binding:"omitempty,max=512"`
	APIKey     string `json:"api_key"`
	Protocol   string `json:"protocol" binding:"required,oneof=openai anthropic"`
	TaskId     int    `json:"task_id"`
	ChannelID  int    `json:"channel_id"`
	ChannelKey int    `json:"channel_key_index"`
}

func normalizeUpstreamMonitorModels(models []string, legacy string) []string {
	result := make([]string, 0, len(models)+1)
	seen := make(map[string]struct{}, len(models)+1)
	appendModel := func(raw string) {
		model := strings.TrimSpace(raw)
		if model == "" {
			return
		}
		if _, exists := seen[model]; exists {
			return
		}
		seen[model] = struct{}{}
		result = append(result, model)
	}
	for _, model := range models {
		appendModel(model)
	}
	if len(result) == 0 {
		appendModel(legacy)
	}
	return result
}

func normalizeUpstreamMonitorRequest(req *upstreamMonitorTaskRequest) error {
	req.Name = strings.TrimSpace(req.Name)
	req.ChannelGroup = strings.TrimSpace(req.ChannelGroup)
	req.APIKey = strings.TrimSpace(req.APIKey)
	if req.ChannelID > 0 {
		// Channel-backed task: address and key come from channel management.
		// Store an encrypted snapshot at save time; the live channel is read
		// again on every probe and discovery.
		endpoint, err := service.ChannelEndpoint(req.ChannelID, req.ChannelKeyIndex)
		if err != nil {
			return err
		}
		req.BaseURL = strings.TrimRight(strings.TrimSpace(endpoint.BaseURL), "/")
		req.APIKey = endpoint.APIKey
		if len(req.Models) == 0 {
			req.Models = endpoint.Models
		}
		if req.ChannelGroup == "" {
			req.ChannelGroup = endpoint.ChannelGroup
		}
	} else {
		req.BaseURL = strings.TrimRight(strings.TrimSpace(req.BaseURL), "/")
	}
	req.Models = normalizeUpstreamMonitorModels(req.Models, req.Model)
	if len(req.Models) > 0 {
		req.Model = req.Models[0]
	}
	if req.ProbeDepth == "" {
		req.ProbeDepth = service.UpstreamDepthStandard
	}
	if req.Enabled == nil {
		enabled := true
		req.Enabled = &enabled
	}
	return nil
}

func marshalUpstreamMonitorModels(models []string) (string, error) {
	if len(models) == 0 {
		return "", nil
	}
	encoded, err := common.Marshal(models)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func upstreamMonitorTaskToResponse(task *model.UpstreamMonitorTask) gin.H {
	return gin.H{
		"id":                    task.Id,
		"name":                  task.Name,
		"channel_id":            task.ChannelId,
		"channel_name":          task.ChannelName,
		"channel_group":         task.ChannelGroup,
		"channel_key_index":     task.ChannelKeyIndex,
		"base_url":              task.BaseURL,
		"api_key_fingerprint":   task.APIKeyFingerprint,
		"model":                 task.Model,
		"models":                task.MonitorModels(),
		"protocol":              task.Protocol,
		"check_interval_minute": task.CheckIntervalMinute,
		"probe_depth":           task.ProbeDepth,
		"enabled":               task.Enabled,
		"status":                task.Status,
		"last_score":            task.LastScore,
		"last_verdict":          task.LastVerdict,
		"last_run_at":           task.LastRunAt,
		"created_at":            task.CreatedAt,
		"updated_at":            task.UpdatedAt,
	}
}

// upstreamProtocolForChannel infers the probe protocol from a channel type.
// Delegates to the service helper so manual monitor creation and channel
// auto-sync share one mapping. Users can still override it in the monitor form.
func upstreamProtocolForChannel(channelType int) string {
	return service.UpstreamProtocolForChannel(channelType)
}

// GetUpstreamMonitorChannels lists channels available for monitoring. Only
// display-safe fields are returned: API keys are masked and never plaintext.
func GetUpstreamMonitorChannels(c *gin.Context) {
	// selectAll loads the key column so it can be masked for display; no
	// plaintext key is ever written to the response.
	channels, err := model.GetAllChannels(0, 0, true, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]gin.H, 0, len(channels))
	for _, channel := range channels {
		keys := channel.GetKeys()
		masked := make([]string, 0, len(keys))
		for _, key := range keys {
			masked = append(masked, common.MaskSecretValue(jsplugin.RedactCredentialLines(key)))
		}
		items = append(items, gin.H{
			"id":           channel.Id,
			"name":         channel.Name,
			"group":        channel.Group,
			"type":         channel.Type,
			"base_url":     channel.GetBaseURL(),
			"models":       channel.GetModels(),
			"protocol":     upstreamProtocolForChannel(channel.Type),
			"masked_keys":  masked,
			"is_multi_key": channel.ChannelInfo.IsMultiKey,
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

func parseUpstreamMonitorID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid monitor id")
		return 0, false
	}
	return id, true
}

// GetUpstreamMonitorTasks lists all monitoring tasks. Secrets are never included.
func GetUpstreamMonitorTasks(c *gin.Context) {
	// One-shot reconcile so channels created before channel↔monitor linkage,
	// or through a path without a hook, are picked up automatically. Errors are
	// logged but never block listing existing tasks.
	reconcileUpstreamMonitorOnce.Do(func() {
		if err := service.ReconcileChannelMonitors(); err != nil {
			common.SysError(common.LogText("upstream monitor initial reconcile: %v", err))
		}
	})
	tasks, err := model.ListUpstreamMonitorTasks()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]gin.H, 0, len(tasks))
	for _, task := range tasks {
		items = append(items, upstreamMonitorTaskToResponse(task))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

// FetchUpstreamMonitorModels discovers the models advertised by an upstream.
// A saved task id may be supplied instead of an API key when editing an
// existing monitor; the key is decrypted in memory only.
func FetchUpstreamMonitorModels(c *gin.Context) {
	var req upstreamMonitorModelsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid request")
		return
	}
	req.BaseURL = strings.TrimRight(strings.TrimSpace(req.BaseURL), "/")
	apiKey := strings.TrimSpace(req.APIKey)

	// Channel-backed discovery reads the model list configured on the channel
	// in channel management. The browser never receives the channel key.
	if req.ChannelID > 0 {
		endpoint, err := service.ChannelEndpoint(req.ChannelID, req.ChannelKey)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"models": endpoint.Models}})
		return
	}

	if apiKey == "" {
		if req.TaskId <= 0 {
			common.ApiErrorT(c, "API key is required")
			return
		}
		task, err := model.GetUpstreamMonitorTask(req.TaskId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if task == nil {
			common.ApiErrorT(c, "Monitor task not found")
			return
		}
		if task.ChannelId > 0 {
			endpoint, err := service.ChannelEndpoint(task.ChannelId, task.ChannelKeyIndex)
			if err != nil {
				common.ApiError(c, err)
				return
			}
			c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"models": endpoint.Models}})
			return
		}
		apiKey, err = service.DecryptUpstreamAPIKey(task.APIKeyEncrypted)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	models, err := service.FetchUpstreamModels(c.Request.Context(), req.BaseURL, apiKey, req.Protocol)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"models": models}})
}

// CreateUpstreamMonitorTask registers a new upstream endpoint. The API key is
// encrypted at rest and only a masked fingerprint is exposed afterwards.
func CreateUpstreamMonitorTask(c *gin.Context) {
	var req upstreamMonitorTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid request")
		return
	}
	if req.ChannelID <= 0 && req.APIKey == "" {
		common.ApiErrorT(c, "API key is required")
		return
	}
	if err := normalizeUpstreamMonitorRequest(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(req.Models) == 0 {
		common.ApiErrorT(c, "At least one model is required")
		return
	}
	modelsJSON, err := marshalUpstreamMonitorModels(req.Models)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	encrypted, err := service.EncryptUpstreamAPIKey(req.APIKey)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	channelName := ""
	if req.ChannelID > 0 {
		endpoint, err := service.ChannelEndpoint(req.ChannelID, req.ChannelKeyIndex)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		channelName = endpoint.ChannelName
	}
	task := &model.UpstreamMonitorTask{
		Name:                req.Name,
		ChannelId:           req.ChannelID,
		ChannelName:         channelName,
		ChannelGroup:        req.ChannelGroup,
		ChannelKeyIndex:     req.ChannelKeyIndex,
		BaseURL:             req.BaseURL,
		APIKeyEncrypted:     encrypted,
		APIKeyFingerprint:   service.UpstreamAPIKeyFingerprint(req.APIKey),
		Model:               req.Model,
		Models:              modelsJSON,
		Protocol:            req.Protocol,
		CheckIntervalMinute: req.CheckIntervalMinute,
		ProbeDepth:          req.ProbeDepth,
		Enabled:             *req.Enabled,
		Status:              "unknown",
		LastVerdict:         "unknown",
	}
	if err := model.CreateUpstreamMonitorTask(task); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": upstreamMonitorTaskToResponse(task)})
}

// UpdateUpstreamMonitorTask updates task fields. A blank api_key keeps the
// stored credential, so rotating it is explicit.
func UpdateUpstreamMonitorTask(c *gin.Context) {
	id, ok := parseUpstreamMonitorID(c)
	if !ok {
		return
	}
	task, err := model.GetUpstreamMonitorTask(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if task == nil {
		common.ApiErrorT(c, "Monitor task not found")
		return
	}
	var req upstreamMonitorTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid request")
		return
	}
	// Legacy tasks keep their credential when api_key is left blank. A
	// channel-backed task always re-reads the key from channel management and
	// refreshes its snapshot on save.
	legacyKeepKey := req.ChannelID <= 0 && req.APIKey == ""
	if legacyKeepKey {
		req.APIKey = "placeholder"
	}
	if err := normalizeUpstreamMonitorRequest(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(req.Models) == 0 {
		common.ApiErrorT(c, "At least one model is required")
		return
	}
	modelsJSON, err := marshalUpstreamMonitorModels(req.Models)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	channelName := ""
	if req.ChannelID > 0 {
		endpoint, err := service.ChannelEndpoint(req.ChannelID, req.ChannelKeyIndex)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		channelName = endpoint.ChannelName
	}
	updates := map[string]any{
		"name":                  req.Name,
		"channel_id":            req.ChannelID,
		"channel_name":          channelName,
		"channel_group":         req.ChannelGroup,
		"channel_key_index":     req.ChannelKeyIndex,
		"base_url":              req.BaseURL,
		"model":                 req.Model,
		"models":                modelsJSON,
		"protocol":              req.Protocol,
		"check_interval_minute": req.CheckIntervalMinute,
		"probe_depth":           req.ProbeDepth,
		"enabled":               *req.Enabled,
	}
	if !legacyKeepKey {
		encrypted, err := service.EncryptUpstreamAPIKey(req.APIKey)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		updates["api_key_encrypted"] = encrypted
		updates["api_key_fingerprint"] = service.UpstreamAPIKeyFingerprint(req.APIKey)
	}
	if err := model.UpdateUpstreamMonitorTask(task, updates); err != nil {
		common.ApiError(c, err)
		return
	}
	updated, err := model.GetUpstreamMonitorTask(id)
	if err != nil || updated == nil {
		common.ApiErrorT(c, "Monitor task not found after update")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": upstreamMonitorTaskToResponse(updated)})
}

func DeleteUpstreamMonitorTask(c *gin.Context) {
	id, ok := parseUpstreamMonitorID(c)
	if !ok {
		return
	}
	if err := model.DeleteUpstreamMonitorTask(id); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// RunUpstreamMonitorNow triggers a one-off probe run for a single task.
func RunUpstreamMonitorNow(c *gin.Context) {
	id, ok := parseUpstreamMonitorID(c)
	if !ok {
		return
	}
	task, err := model.GetUpstreamMonitorTask(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if task == nil {
		common.ApiErrorT(c, "Monitor task not found")
		return
	}
	result, err := service.RunAndPersistUpstreamMonitor(c.Request.Context(), task)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

func GetUpstreamMonitorTask(c *gin.Context) {
	id, ok := parseUpstreamMonitorID(c)
	if !ok {
		return
	}
	task, err := model.GetUpstreamMonitorTask(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if task == nil {
		common.ApiErrorT(c, "Monitor task not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": upstreamMonitorTaskToResponse(task)})
}

func GetUpstreamMonitorReports(c *gin.Context) {
	id, ok := parseUpstreamMonitorID(c)
	if !ok {
		return
	}
	offset, _ := strconv.Atoi(c.Query("offset"))
	limit, _ := strconv.Atoi(c.Query("page_size"))
	reports, total, err := model.ListUpstreamMonitorReports(id, c.Query("model"), offset, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]gin.H, 0, len(reports))
	for _, report := range reports {
		items = append(items, upstreamMonitorReportToResponse(report))
	}
	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"data":      items,
		"total":     total,
		"offset":    offset,
		"page_size": limit,
	})
}

func GetUpstreamMonitorReport(c *gin.Context) {
	id, ok := parseUpstreamMonitorID(c)
	if !ok {
		return
	}
	report, err := model.GetUpstreamMonitorReport(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if report == nil {
		common.ApiErrorT(c, "Monitor report not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": upstreamMonitorReportToResponse(report)})
}

func upstreamMonitorReportToResponse(report *model.UpstreamMonitorReport) gin.H {
	return gin.H{
		"id":         report.Id,
		"task_id":    report.TaskId,
		"model":      report.Model,
		"run_id":     report.RunId,
		"score":      report.Score,
		"verdict":    report.Verdict,
		"dimensions": decodeJSONField(report.Dimensions),
		"metrics":    decodeJSONField(report.Metrics),
		"probes":     decodeJSONField(report.Probes),
		"billing":    decodeJSONField(report.Billing),
		"async_task": decodeJSONField(report.AsyncTask),
		"error":      report.Error,
		"created_at": report.CreatedAt,
	}
}

func decodeJSONField(raw string) any {
	if raw == "" {
		return nil
	}
	var value any
	if err := common.UnmarshalJsonStr(raw, &value); err != nil {
		return raw
	}
	return value
}
