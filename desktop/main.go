package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/atotto/clipboard"
	"github.com/getlantern/systray"
)

const trigger = "!@#"

type Config struct {
	APIURL string `json:"api_url"`
	APIKey string `json:"api_key"`
}

var config Config

// 16x16 ICO — blue "EN" (idle)
var iconIdle = makeICO(59, 130, 246)

// 16x16 ICO — green (success flash)
var iconSuccess = makeICO(34, 197, 94)

// 16x16 ICO — orange (translating)
var iconBusy = makeICO(245, 158, 11)

func makeICO(r, g, b byte) []byte {
	w, h := 16, 16
	pixels := make([]byte, w*h*4)

	// 5-pointed star coordinates (center 7.5, 7.5, outer radius 7, inner radius 3)
	cx, cy := 7.5, 7.5
	outerR, innerR := 7.0, 3.0
	starPoints := make([][2]float64, 10)
	for i := 0; i < 10; i++ {
		angle := float64(i)*0.6283185307 - 1.5707963268 // 36 degrees each, start from top
		radius := outerR
		if i%2 == 1 {
			radius = innerR
		}
		starPoints[i] = [2]float64{
			cx + radius*cos(angle),
			cy + radius*sin(angle),
		}
	}

	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			inside := pointInPolygon(float64(x)+0.5, float64(y)+0.5, starPoints[:])
			idx := (y*w + x) * 4
			if inside {
				pixels[idx+0] = b
				pixels[idx+1] = g
				pixels[idx+2] = r
				pixels[idx+3] = 255
			} else {
				pixels[idx+3] = 0 // transparent
			}
		}
	}

	mask := make([]byte, ((w+31)/32)*4*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			idx := (y*w + x) * 4
			if pixels[idx+3] == 0 {
				byteIdx := y*((w+31)/32)*4 + x/8
				bitIdx := uint(7 - x%8)
				mask[byteIdx] |= 1 << bitIdx
			}
		}
	}

	bmpSize := 40 + len(pixels) + len(mask)
	dataOffset := 6 + 16

	ico := make([]byte, 0, dataOffset+bmpSize)
	ico = append(ico, 0, 0, 1, 0, 1, 0)
	ico = append(ico, byte(w), byte(h), 0, 0, 1, 0, 32, 0)
	ico = append(ico, byte(bmpSize), byte(bmpSize>>8), byte(bmpSize>>16), byte(bmpSize>>24))
	ico = append(ico, byte(dataOffset), byte(dataOffset>>8), byte(dataOffset>>16), byte(dataOffset>>24))

	bih := make([]byte, 40)
	bih[0] = 40
	bih[4] = byte(w)
	bih[8] = byte(h * 2)
	bih[12] = 1
	bih[14] = 32
	ico = append(ico, bih...)

	for y := h - 1; y >= 0; y-- {
		ico = append(ico, pixels[y*w*4:(y+1)*w*4]...)
	}
	ico = append(ico, mask...)
	return ico
}

func cos(x float64) float64 {
	// Taylor series approximation (good enough for icon generation)
	x = mod2pi(x)
	x2 := x * x
	return 1 - x2/2 + x2*x2/24 - x2*x2*x2/720 + x2*x2*x2*x2/40320
}

func sin(x float64) float64 {
	return cos(x - 1.5707963268)
}

func mod2pi(x float64) float64 {
	const twoPi = 6.2831853072
	for x > 3.1415926536 {
		x -= twoPi
	}
	for x < -3.1415926536 {
		x += twoPi
	}
	return x
}

func pointInPolygon(px, py float64, poly [][2]float64) bool {
	inside := false
	n := len(poly)
	j := n - 1
	for i := 0; i < n; i++ {
		xi, yi := poly[i][0], poly[i][1]
		xj, yj := poly[j][0], poly[j][1]
		if ((yi > py) != (yj > py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi) {
			inside = !inside
		}
		j = i
	}
	return inside
}

func configPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".native-english-translator.json")
}

func loadConfig() {
	config = Config{APIURL: "https://net-six-ashen.vercel.app/api/translate"}
	data, _ := os.ReadFile(configPath())
	if len(data) > 0 {
		json.Unmarshal(data, &config)
	}
}

func saveConfig() {
	data, _ := json.MarshalIndent(config, "", "  ")
	os.WriteFile(configPath(), data, 0644)
}

func translate(text string) (string, error) {
	body, _ := json.Marshal(map[string]string{"text": text})
	req, err := http.NewRequest("POST", config.APIURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", config.APIKey)

	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var result struct {
		Translated string `json:"translated"`
		Error      string `json:"error"`
	}
	json.Unmarshal(respBody, &result)
	if result.Error != "" {
		return "", fmt.Errorf("%s", result.Error)
	}
	return result.Translated, nil
}

func flashIcon() {
	systray.SetIcon(iconSuccess)
	time.Sleep(300 * time.Millisecond)
	systray.SetIcon(iconIdle)
	time.Sleep(200 * time.Millisecond)
	systray.SetIcon(iconSuccess)
	time.Sleep(300 * time.Millisecond)
	systray.SetIcon(iconIdle)
}

func watchClipboard() {
	prev := ""
	for {
		text, err := clipboard.ReadAll()
		if err != nil || text == prev {
			time.Sleep(300 * time.Millisecond)
			continue
		}
		prev = text

		trimmed := strings.TrimSpace(text)
		if !strings.HasSuffix(trimmed, trigger) {
			time.Sleep(300 * time.Millisecond)
			continue
		}

		input := strings.TrimSpace(strings.TrimSuffix(trimmed, trigger))
		if input == "" {
			time.Sleep(300 * time.Millisecond)
			continue
		}

		// Show busy icon
		systray.SetIcon(iconBusy)
		systray.SetTooltip("Translating...")

		result, err := translate(input)
		if err != nil {
			systray.SetIcon(iconIdle)
			systray.SetTooltip("Native English Translator — Error: " + err.Error())
			time.Sleep(300 * time.Millisecond)
			continue
		}

		clipboard.WriteAll(result)
		prev = result

		// Flash green + toast
		systray.SetTooltip("Translated! Ctrl+V to paste")
		go flashIcon()
		go toast("Translated", result)

		time.Sleep(300 * time.Millisecond)
	}
}

func toast(title, msg string) {
	switch runtime.GOOS {
	case "windows":
		// Use wscript to show a timed popup — no console flash
		vbs := fmt.Sprintf(
			`CreateObject("Wscript.Shell").Popup "%s", 3, "%s", 64`,
			strings.ReplaceAll(msg, `"`, `""`),
			strings.ReplaceAll(title, `"`, `""`))
		tmpFile := filepath.Join(os.TempDir(), "net_toast.vbs")
		os.WriteFile(tmpFile, []byte(vbs), 0644)
		exec.Command("wscript", tmpFile).Start()
	case "linux":
		exec.Command("notify-send", "-t", "3000", title, msg).Start()
	}
}

func openConfigFile() {
	if _, err := os.Stat(configPath()); os.IsNotExist(err) {
		saveConfig()
	}
	switch runtime.GOOS {
	case "windows":
		exec.Command("notepad", configPath()).Start()
	case "linux":
		exec.Command("xdg-open", configPath()).Start()
	}
}

func onReady() {
	systray.SetIcon(iconIdle)
	systray.SetTitle("EN")
	systray.SetTooltip("Native English Translator — copy text ending with !@# to translate")

	mStatus := systray.AddMenuItem(fmt.Sprintf("Trigger: %s", trigger), "")
	mStatus.Disable()
	systray.AddSeparator()
	mConfig := systray.AddMenuItem("Open Config", "")
	mQuit := systray.AddMenuItem("Quit", "")

	go watchClipboard()

	go func() {
		for {
			select {
			case <-mConfig.ClickedCh:
				openConfigFile()
			case <-mQuit.ClickedCh:
				systray.Quit()
			}
		}
	}()
}

func onExit() {}

func main() {
	loadConfig()

	if config.APIKey == "" {
		saveConfig()
		openConfigFile()
		fmt.Println("Set api_key in config, then restart.")
		time.Sleep(2 * time.Second)
		return
	}

	systray.Run(onReady, onExit)
}
