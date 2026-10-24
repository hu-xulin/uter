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
*/

package service

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
)

// The waffo-go SDK does not speak PEM: `config.ValidatePrivateKey` /
// `ValidatePublicKey` base64-decode the configured string and parse it as
// PKCS#8 / X.509 SubjectPublicKeyInfo DER. A value that still carries
// "-----BEGIN ...-----" therefore fails to decode, and the merchant silently
// loses the ability to sign or verify requests.
//
// Administrators, however, obtain key material as files (private.pem,
// public.pem, or the certificate Waffo issues). Making the settings accept a
// file therefore requires normalizing PEM / certificate input into the bare
// Base64 DER the SDK expects, instead of forcing operators to strip the
// headers by hand.

var (
	// ErrWaffoPrivateKeyInvalid is returned when the configured merchant
	// private key cannot be turned into a PKCS#8 key.
	ErrWaffoPrivateKeyInvalid = errors.New("invalid Waffo private key")
	// ErrWaffoPublicKeyInvalid is returned when the configured Waffo public
	// key or certificate cannot be turned into an X.509 public key.
	ErrWaffoPublicKeyInvalid = errors.New("invalid Waffo public key")
)

// stripKeyWhitespace removes every whitespace character. Keys copied out of a
// PEM file keep their line breaks, and Base64 decoders reject those.
func stripKeyWhitespace(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch r {
		case ' ', '\t', '\n', '\r':
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// NormalizeWaffoPrivateKey converts a configured Waffo merchant private key
// into the bare Base64 PKCS#8 form the SDK expects.
//
// Accepted inputs:
//   - a PKCS#8 PEM file ("-----BEGIN PRIVATE KEY-----"), the SDK's native form;
//   - a PKCS#1 PEM file ("-----BEGIN RSA PRIVATE KEY-----"), re-encoded to PKCS#8;
//   - a bare Base64 PKCS#8 body, passed through unchanged.
func NormalizeWaffoPrivateKey(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", fmt.Errorf("%w: key is empty", ErrWaffoPrivateKeyInvalid)
	}

	if !strings.Contains(value, "BEGIN") {
		// Bare Base64 body: the SDK expects PKCS#8, so verify it before use.
		compact := stripKeyWhitespace(value)
		decoded, err := base64.StdEncoding.DecodeString(compact)
		if err != nil {
			return "", fmt.Errorf("%w: not valid base64: %v", ErrWaffoPrivateKeyInvalid, err)
		}
		if _, err := x509.ParsePKCS8PrivateKey(decoded); err != nil {
			return "", fmt.Errorf("%w: not a PKCS#8 key: %v", ErrWaffoPrivateKeyInvalid, err)
		}
		return compact, nil
	}

	block, _ := pem.Decode([]byte(value))
	if block == nil {
		return "", fmt.Errorf("%w: no PEM block found", ErrWaffoPrivateKeyInvalid)
	}

	var rsaKey *rsa.PrivateKey
	switch block.Type {
	case "PRIVATE KEY":
		parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return "", fmt.Errorf("%w: %v", ErrWaffoPrivateKeyInvalid, err)
		}
		rsaKey, _ = parsed.(*rsa.PrivateKey)
		if rsaKey == nil {
			return "", fmt.Errorf("%w: key is not an RSA key", ErrWaffoPrivateKeyInvalid)
		}
	case "RSA PRIVATE KEY":
		parsed, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return "", fmt.Errorf("%w: %v", ErrWaffoPrivateKeyInvalid, err)
		}
		rsaKey = parsed
	default:
		return "", fmt.Errorf("%w: unsupported PEM block type %q", ErrWaffoPrivateKeyInvalid, block.Type)
	}

	der, err := x509.MarshalPKCS8PrivateKey(rsaKey)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrWaffoPrivateKeyInvalid, err)
	}
	return base64.StdEncoding.EncodeToString(der), nil
}

// NormalizeWaffoPublicKey converts a configured Waffo public key into the bare
// Base64 X.509 SubjectPublicKeyInfo form the SDK expects.
//
// Accepted inputs:
//   - an SPKI PEM file ("-----BEGIN PUBLIC KEY-----"), the SDK's native form;
//   - a PKCS#1 PEM file ("-----BEGIN RSA PUBLIC KEY-----"), re-encoded to SPKI;
//   - the certificate Waffo issues ("-----BEGIN CERTIFICATE-----"), whose public
//     key is extracted;
//   - a bare Base64 SPKI body, passed through unchanged.
func NormalizeWaffoPublicKey(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", fmt.Errorf("%w: key is empty", ErrWaffoPublicKeyInvalid)
	}

	if !strings.Contains(value, "BEGIN") {
		compact := stripKeyWhitespace(value)
		decoded, err := base64.StdEncoding.DecodeString(compact)
		if err != nil {
			return "", fmt.Errorf("%w: not valid base64: %v", ErrWaffoPublicKeyInvalid, err)
		}
		if _, err := x509.ParsePKIXPublicKey(decoded); err != nil {
			return "", fmt.Errorf("%w: not an X.509 public key: %v", ErrWaffoPublicKeyInvalid, err)
		}
		return compact, nil
	}

	block, _ := pem.Decode([]byte(value))
	if block == nil {
		return "", fmt.Errorf("%w: no PEM block found", ErrWaffoPublicKeyInvalid)
	}

	var publicKey *rsa.PublicKey
	switch block.Type {
	case "PUBLIC KEY":
		parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
		if err != nil {
			return "", fmt.Errorf("%w: %v", ErrWaffoPublicKeyInvalid, err)
		}
		rsaKey, ok := parsed.(*rsa.PublicKey)
		if !ok {
			return "", fmt.Errorf("%w: key is not an RSA key", ErrWaffoPublicKeyInvalid)
		}
		publicKey = rsaKey
	case "RSA PUBLIC KEY":
		parsed, err := x509.ParsePKCS1PublicKey(block.Bytes)
		if err != nil {
			return "", fmt.Errorf("%w: %v", ErrWaffoPublicKeyInvalid, err)
		}
		publicKey = parsed
	case "CERTIFICATE":
		certificate, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return "", fmt.Errorf("%w: %v", ErrWaffoPublicKeyInvalid, err)
		}
		rsaKey, ok := certificate.PublicKey.(*rsa.PublicKey)
		if !ok {
			return "", fmt.Errorf("%w: certificate does not carry an RSA public key", ErrWaffoPublicKeyInvalid)
		}
		publicKey = rsaKey
	default:
		return "", fmt.Errorf("%w: unsupported PEM block type %q", ErrWaffoPublicKeyInvalid, block.Type)
	}

	der, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrWaffoPublicKeyInvalid, err)
	}
	return base64.StdEncoding.EncodeToString(der), nil
}
