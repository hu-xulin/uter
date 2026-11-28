// Command review-needs-review-rows inspects a channel's historical
// needs_review pricing rows and, only with an explicit -apply, repairs the
// narrow subset that is a known cross-check false positive.
//
// It defaults to READ-ONLY. Tiered prices, missing channel quotes and any
// unrecognized reason are reported for a human decision and are never touched.
// The apply path delegates to RejudgeBailianOfficialListCrossCheck, which
// keeps the rejudge audit-field constraints (exact reason, authoritative list
// price, no surviving reason) and writes sale prices fail-closed.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/glebarez/sqlite"
	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
	"gorm.io/gorm"
)

type output struct {
	Inspection service.NeedsReviewInspection           `json:"inspection"`
	Applied    *service.BailianCrossCheckRejudgeResult `json:"applied,omitempty"`
}

func main() {
	dbPath := flag.String("db", "one-api.db", "SQLite database path")
	channelID := flag.Int("channel", 0, "channel id to inspect")
	apply := flag.Bool("apply", false, "explicitly repair known false positives after backing up the database")
	flag.Parse()

	if *channelID <= 0 {
		fmt.Fprintln(os.Stderr, "-channel must be a positive id")
		os.Exit(2)
	}
	if _, err := os.Stat(*dbPath); err != nil {
		fmt.Fprintf(os.Stderr, "database %q is not accessible: %v\n", *dbPath, err)
		os.Exit(2)
	}

	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	common.SQLitePath = common.SQLiteForeignKeysEnabledDSN(*dbPath)
	db, err := gorm.Open(sqlite.Open(common.SQLitePath), &gorm.Config{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "open database failed: %v\n", err)
		os.Exit(1)
	}
	model.DB = db

	inspection, err := service.InspectNeedsReviewPricing(*channelID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "inspect failed: %v\n", err)
		os.Exit(1)
	}
	result := output{Inspection: inspection}
	if *apply {
		if len(inspection.Manual) > 0 {
			fmt.Fprintf(os.Stderr,
				"refusing to auto-apply: %d rows still need a human decision (see inspection.needs_human_decision)\n",
				len(inspection.Manual))
			os.Exit(3)
		}
		rejudged, err := service.RejudgeBailianOfficialListCrossCheck(*channelID, true)
		if err != nil {
			fmt.Fprintf(os.Stderr, "apply failed: %v\n", err)
			os.Exit(1)
		}
		result.Applied = &rejudged
	}
	encoded, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "encode result failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(string(encoded))
}
