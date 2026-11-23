/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/

package service

import (
	"math"
	"testing"
)

// The ratio login sync engine was retired in favour of the public pricing
// adapter in upstream_uterroute.go. roundRatioValue is still used by that
// path, so its rounding contract stays covered here; the engine-specific
// compute-target tests went away together with the engine.
func TestRoundRatioValue(t *testing.T) {
	cases := []struct {
		in   float64
		want float64
	}{
		{1.75, 1.75},
		{0.027550000000000002, 0.02755},
		{3.000750187547124, 3.0007501875},
		{0, 0},
	}
	for _, c := range cases {
		if got := roundRatioValue(c.in); !nearlyEqualSync(got, c.want) {
			t.Errorf("roundRatioValue(%v) = %v, want %v", c.in, got, c.want)
		}
	}
	if got := roundRatioValue(math.NaN()); !math.IsNaN(got) {
		t.Errorf("roundRatioValue(NaN) = %v, want NaN", got)
	}
}
