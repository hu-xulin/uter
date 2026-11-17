package pricing_engine

import "testing"

func TestNormalizeResolveAndGlobal(t *testing.T) {
	SetGlobal("")
	t.Cleanup(func() { SetGlobal(EngineUter) })
	if Global() != EngineUter {
		t.Fatalf("default engine = %q", Global())
	}
	if Normalize(" UpStReAm ") != EngineUpstream || Normalize("uter") != EngineUter || Normalize("other") != "" {
		t.Fatalf("normalize failed")
	}
	if Resolve("") != EngineUter || Resolve("upstream") != EngineUpstream || Resolve("bogus") != EngineUter {
		t.Fatalf("resolve with default failed")
	}
	SetGlobal(EngineUpstream)
	if !UsesUpstream("") || UsesUpstream("uter") || Resolve("bogus") != EngineUpstream {
		t.Fatalf("global upstream resolution failed")
	}
}
