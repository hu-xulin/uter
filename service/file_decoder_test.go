package service

import "testing"

func TestGetMimeTypeByExtension(t *testing.T) {
	t.Parallel()

	tests := []struct {
		extension string
		want      string
	}{
		{extension: "txt", want: "text/plain"},
		{extension: "md", want: "text/plain"},
		{extension: "markdown", want: "text/plain"},
		{extension: "csv", want: "text/plain"},
		{extension: "json", want: "text/plain"},
		{extension: "xml", want: "text/plain"},
		{extension: "html", want: "text/plain"},
		{extension: "htm", want: "text/plain"},
		{extension: "JPG", want: "image/jpeg"},
		{extension: "jpeg", want: "image/jpeg"},
		{extension: "png", want: "image/png"},
		{extension: "gif", want: "image/gif"},
		{extension: "jfif", want: "image/jpeg"},
		{extension: "heic", want: "image/heic"},
		{extension: "heif", want: "image/heif"},
		{extension: "mp3", want: "audio/mp3"},
		{extension: "wav", want: "audio/wav"},
		{extension: "mpeg", want: "audio/mpeg"},
		{extension: "mp4", want: "video/mp4"},
		{extension: "wmv", want: "video/wmv"},
		{extension: "flv", want: "video/flv"},
		{extension: "mov", want: "video/mov"},
		{extension: "mpg", want: "video/mpg"},
		{extension: "avi", want: "video/avi"},
		{extension: "mpegps", want: "video/mpegps"},
		{extension: "pdf", want: "application/pdf"},
		{extension: "unknown", want: "application/octet-stream"},
		{extension: "", want: "application/octet-stream"},
	}
	for _, tt := range tests {
		t.Run(tt.extension, func(t *testing.T) {
			if got := GetMimeTypeByExtension(tt.extension); got != tt.want {
				t.Fatalf("GetMimeTypeByExtension(%q) = %q, want %q", tt.extension, got, tt.want)
			}
		})
	}
}
