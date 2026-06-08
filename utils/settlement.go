package utils

import (
	"regexp"
	"strings"
)

var cyrillic = regexp.MustCompile(`[А-Яа-яЁёіў]`)

func normalize(s string) string {
	s = strings.Map(func(r rune) rune {
		switch r {
		case '\u200B', '\u200C', '\u200D', '\uFEFF', '\u00A0', '\u00AD':
			return -1
		}
		return r
	}, s)

	s = strings.ReplaceAll(s, "'", "")
	s = strings.ReplaceAll(s, "’", "")
	s = strings.ReplaceAll(s, "“", "")
	s = strings.ReplaceAll(s, "”", "")
	s = strings.ReplaceAll(s, "\"", "")

	return s
}

func ExtractRussianName(alternatenames string) string {
	if alternatenames == "" {
		return ""
	}

	parts := strings.Split(alternatenames, ",")
	for _, p := range parts {
		p = normalize(strings.TrimSpace(p))
		if cyrillic.MatchString(p) {
			return p
		}
	}

	if len(parts) > 0 {
		return strings.TrimSpace(parts[0])
	}
	return ""
}

func MatchUserInput(userInput, dbValue string) bool {
	userInput = normalize(strings.ToLower(strings.TrimSpace(userInput)))
	if userInput == "" {
		return false
	}

	parts := strings.Split(dbValue, ",")
	for _, p := range parts {
		p = normalize(strings.ToLower(strings.TrimSpace(p)))
		if cyrillic.MatchString(p) && p == userInput {
			return true
		}
	}
	return false
}

func CleanSettlementName(name string) string {
	return normalize(strings.TrimSpace(name))
}
