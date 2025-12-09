// internal/utils/pointers.go
package utils

// UintPtr создает указатель на uint
func UintPtr(val uint) *uint {
	return &val
}

// IntPtr создает указатель на int
func IntPtr(val int) *int {
	return &val
}

// BoolPtr создает указатель на bool
func BoolPtr(val bool) *bool {
	return &val
}

// StringPtr создает указатель на string
func StringPtr(val string) *string {
	return &val
}
