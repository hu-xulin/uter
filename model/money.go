package model

import (
	"database/sql/driver"
	"fmt"
	"math"

	"github.com/shopspring/decimal"
)

// Money is an exact monetary amount. It keeps a decimal decimal representation
// in memory, serializes as an unquoted JSON number for API compatibility, and
// stores as a decimal string through database/sql. Ratios, multipliers and
// quota-per-unit constants stay float64; this type is only for money.
type Money struct {
	d decimal.Decimal
}

var zeroMoney = Money{d: decimal.Zero}

func MoneyFromDecimal(d decimal.Decimal) Money {
	if d.IsZero() {
		return zeroMoney
	}
	return Money{d: d}
}

func MoneyFromFloat(value float64) Money {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return zeroMoney
	}
	return MoneyFromDecimal(decimal.NewFromFloat(value))
}

func MoneyFromFloatPtr(value *float64) *Money {
	if value == nil {
		return nil
	}
	money := MoneyFromFloat(*value)
	return &money
}

func MoneyFromString(value string) (Money, error) {
	d, err := decimal.NewFromString(value)
	if err != nil {
		return zeroMoney, err
	}
	return MoneyFromDecimal(d), nil
}

func MustMoney(value string) Money {
	m, err := MoneyFromString(value)
	if err != nil {
		panic(fmt.Sprintf("invalid money literal %q: %v", value, err))
	}
	return m
}

func (m Money) Decimal() decimal.Decimal {
	if m.d.IsZero() {
		return decimal.Zero
	}
	return m.d
}

func (m Money) Float64() float64 {
	f, _ := m.Decimal().Float64()
	return f
}

func (m Money) String() string { return m.Decimal().String() }

func (m Money) IsZero() bool { return m.Decimal().IsZero() }

func (m Money) Value() (driver.Value, error) {
	return m.Decimal().Value()
}

func (m *Money) Scan(value interface{}) error {
	var d decimal.Decimal
	if err := d.Scan(value); err != nil {
		return err
	}
	m.d = d
	return nil
}

func (m Money) MarshalJSON() ([]byte, error) {
	return []byte(m.Decimal().String()), nil
}

func (m *Money) UnmarshalJSON(data []byte) error {
	return m.Scan(string(data))
}
