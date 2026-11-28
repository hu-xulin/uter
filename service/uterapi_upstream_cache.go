/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT WARRANTY OF ANY KIND, either expressed or implied, including
but not limited to the warranties of merchantability, fitness for a
particular purpose and noninfringement. In no event shall the authors or
copyright holders be liable for any claim, damages or other liability,
whether in an action of contract, tort or otherwise, arising from, out of
or in connection with the software or the use or other dealings in the
software.

For commercial licensing, please contact support@uter.ai
*/
package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"sync"
)

// UterAPIUpstreamCache is an operation-scoped cache for Uter.api upstream
// responses. It is deliberately carried in context instead of kept as a
// package-level TTL cache: a channel-creation request, refresh cycle or preview
// sees one consistent snapshot, while the next operation fetches fresh prices.
type UterAPIUpstreamCache struct {
	mu      sync.Mutex
	pricing map[string]*GenericPricingPayload
	models  map[string][]string
}

type uterAPIUpstreamCacheContextKey struct{}

// WithUterAPIUpstreamCache attaches a fresh cache to ctx, or reuses the cache
// already attached by an outer operation. Passing the returned context to all
// Uter.api helpers in one operation avoids repeated /api/pricing and
// /v1/models calls without ever serving stale data to a later operation.
func WithUterAPIUpstreamCache(ctx context.Context) (context.Context, *UterAPIUpstreamCache) {
	if ctx == nil {
		ctx = context.Background()
	}
	if existing, ok := ctx.Value(uterAPIUpstreamCacheContextKey{}).(*UterAPIUpstreamCache); ok && existing != nil {
		return ctx, existing
	}
	cache := &UterAPIUpstreamCache{
		pricing: make(map[string]*GenericPricingPayload),
		models:  make(map[string][]string),
	}
	return context.WithValue(ctx, uterAPIUpstreamCacheContextKey{}, cache), cache
}

func contextUterAPIUpstreamCache(ctx context.Context) *UterAPIUpstreamCache {
	if ctx == nil {
		return nil
	}
	cache, _ := ctx.Value(uterAPIUpstreamCacheContextKey{}).(*UterAPIUpstreamCache)
	return cache
}

// uterAPIUpstreamCacheID hashes the request identity instead of storing raw
// API keys in a map key. The hash is internal and never logged or returned.
func uterAPIUpstreamCacheID(baseURL string, keys []string) string {
	normalized := normalizeUterAPIKeys(keys)
	if len(normalized) == 0 {
		normalized = []string{""}
	}
	identity := strings.TrimSpace(baseURL) + "\x00" + strings.Join(normalized, "\x00")
	sum := sha256.Sum256([]byte(identity))
	return hex.EncodeToString(sum[:])
}

func (cache *UterAPIUpstreamCache) pricingPayload(id string) (*GenericPricingPayload, bool) {
	if cache == nil {
		return nil, false
	}
	cache.mu.Lock()
	defer cache.mu.Unlock()
	payload, ok := cache.pricing[id]
	return payload, ok
}

func (cache *UterAPIUpstreamCache) setPricingPayload(id string, payload *GenericPricingPayload) {
	if cache == nil || payload == nil {
		return
	}
	cache.mu.Lock()
	defer cache.mu.Unlock()
	cache.pricing[id] = payload
}

func (cache *UterAPIUpstreamCache) modelIDs(id string) ([]string, bool) {
	if cache == nil {
		return nil, false
	}
	cache.mu.Lock()
	defer cache.mu.Unlock()
	ids, ok := cache.models[id]
	if !ok {
		return nil, false
	}
	out := make([]string, len(ids))
	copy(out, ids)
	return out, true
}

func (cache *UterAPIUpstreamCache) setModelIDs(id string, ids []string) {
	if cache == nil {
		return
	}
	out := make([]string, len(ids))
	copy(out, ids)
	cache.mu.Lock()
	defer cache.mu.Unlock()
	cache.models[id] = out
}

func fetchCachedUterAPIPricingPayload(ctx context.Context, baseURL, apiKey string) (*GenericPricingPayload, error) {
	cache := contextUterAPIUpstreamCache(ctx)
	id := uterAPIUpstreamCacheID(baseURL, []string{apiKey})
	if payload, ok := cache.pricingPayload(id); ok {
		return payload, nil
	}
	payload, err := fetchUterAPIPricingPayload(ctx, baseURL, apiKey)
	if err != nil {
		return nil, err
	}
	cache.setPricingPayload(id, payload)
	return payload, nil
}

func fetchCachedUterAPIModelIDs(ctx context.Context, baseURL, apiKey string) ([]string, error) {
	cache := contextUterAPIUpstreamCache(ctx)
	id := uterAPIUpstreamCacheID(baseURL, []string{apiKey})
	if ids, ok := cache.modelIDs(id); ok {
		return ids, nil
	}
	ids, err := OpenAIModelIDs(ctx, baseURL, apiKey)
	if err != nil {
		return nil, err
	}
	cache.setModelIDs(id, ids)
	return ids, nil
}

// OpenAIModelIDsWithUterAPICache is the controller-facing model discovery
// entry point for Uter.api. It reuses an operation cache when the caller has
// attached one and otherwise behaves exactly like OpenAIModelIDs.
func OpenAIModelIDsWithUterAPICache(ctx context.Context, baseURL, apiKey string) ([]string, error) {
	return fetchCachedUterAPIModelIDs(ctx, baseURL, apiKey)
}
