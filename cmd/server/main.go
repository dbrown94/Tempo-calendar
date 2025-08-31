package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	_ "github.com/mattn/go-sqlite3"
)

type Subscription struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

type pushSubRow struct {
	UserID   string
	Endpoint string
	P256dh   string
	Auth     string
	Created  time.Time
}

type logTaskReq struct {
	UserID      string `json:"userId"`
	GoalID      string `json:"goalId"`
	MilestoneID string `json:"milestoneId"`
	TaskID      string `json:"taskId"`
	DeltaMins   int    `json:"deltaMins"`
	// Optional seeds (first time we see a task)
	TaskTitle    string `json:"taskTitle,omitempty"`
	EstimateMins int    `json:"estimateMins,omitempty"`
	Color        string `json:"color,omitempty"`
}

type testPushReq struct {
	UserID string `json:"userId"`
	Title  string `json:"title"`
	Body   string `json:"body"`
}

var (
	db           *sql.DB
	vapidPublic  string
	vapidPrivate string
	vapidSubject string
	webpushOpts  *webpush.Options
)

func main() {
	_ = godotenv.Load()

	var err error
	db, err = sql.Open("sqlite3", "tempo_push.db?_busy_timeout=5000")
	if err != nil {
		log.Fatal(err)
	}
	if err := initDB(); err != nil {
		log.Fatal(err)
	}

	vapidPublic = os.Getenv("VAPID_PUBLIC")
	vapidPrivate = os.Getenv("VAPID_PRIVATE")
	vapidSubject = os.Getenv("VAPID_SUBJECT")
	if vapidPublic == "" || vapidPrivate == "" {
		log.Fatal("Missing VAPID keys in env (.env)")
	}
	webpushOpts = &webpush.Options{
		Subscriber:      vapidSubject,
		VAPIDPublicKey:  vapidPublic,
		VAPIDPrivateKey: vapidPrivate,
		TTL:             30,
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors)

	r.Post("/api/push/subscribe", handleSubscribe)
	r.Post("/api/push/test", handleTestPush)
	r.Post("/api/tasks/log", handleLogTask)

	log.Println("push server listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == "OPTIONS" {
			w.WriteHeader(200)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func initDB() error {
	ddl := []string{
		`CREATE TABLE IF NOT EXISTS push_subscriptions (
			user_id   TEXT NOT NULL,
			endpoint  TEXT PRIMARY KEY,
			p256dh    TEXT NOT NULL,
			auth      TEXT NOT NULL,
			created_at TIMESTAMP NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS tasks (
			task_id TEXT PRIMARY KEY,
			milestone_id TEXT,
			goal_id TEXT,
			title TEXT,
			color TEXT,
			estimate_mins INTEGER NOT NULL,
			logged_mins INTEGER NOT NULL DEFAULT 0
		);`,
	}
	for _, q := range ddl {
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

// ---------- Push subscribe ----------
func handleSubscribe(w http.ResponseWriter, r *http.Request) {
	type payload struct {
		UserID       string       `json:"userId"`
		Subscription Subscription `json:"subscription"`
	}
	var p payload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	if p.UserID == "" || p.Subscription.Endpoint == "" {
		http.Error(w, "missing fields", 400)
		return
	}

	_, err := db.Exec(`INSERT OR REPLACE INTO push_subscriptions
		(user_id, endpoint, p256dh, auth, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		p.UserID, p.Subscription.Endpoint, p.Subscription.Keys.P256dh, p.Subscription.Keys.Auth, time.Now())
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.WriteHeader(204)
}

// ---------- Test push ----------
func handleTestPush(w http.ResponseWriter, r *http.Request) {
	var req testPushReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	if req.UserID == "" {
		http.Error(w, "userId required", 400)
		return
	}

	err := sendPushToUser(r.Context(), req.UserID, map[string]any{
		"title": req.Title,
		"body":  req.Body,
		"kind":  "test",
	})
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.WriteHeader(204)
}

// ---------- Log minutes + milestone check ----------
func handleLogTask(w http.ResponseWriter, r *http.Request) {
	var req logTaskReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	if req.UserID == "" || req.TaskID == "" || req.DeltaMins <= 0 {
		http.Error(w, "missing/invalid fields", 400)
		return
	}

	// Ensure task exists (seed on first log)
	_, _ = db.Exec(`INSERT OR IGNORE INTO tasks(task_id, milestone_id, goal_id, title, color, estimate_mins, logged_mins)
	                VALUES(?,?,?,?,?,?,0)`,
		req.TaskID, req.MilestoneID, req.GoalID, coalesce(req.TaskTitle, req.TaskID), req.Color, max1(req.EstimateMins))

	// Update log
	res, err := db.Exec(`UPDATE tasks
		SET logged_mins = MIN(estimate_mins, logged_mins + ?)
		WHERE task_id = ?`, req.DeltaMins, req.TaskID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, "task not found", 404)
		return
	}

	// Read after update
	var est, logged int
	var title string
	if err := db.QueryRow(`SELECT title, estimate_mins, logged_mins FROM tasks WHERE task_id = ?`, req.TaskID).
		Scan(&title, &est, &logged); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	// Always send a "logged" push
	_ = sendPushToUser(r.Context(), req.UserID, map[string]any{
		"title":  "Time logged",
		"body":   title + " +" + itoa(req.DeltaMins) + "m (" + itoa(logged) + " / " + itoa(est) + "m)",
		"kind":   "log",
		"taskId": req.TaskID,
	})

	// If finished this task, check if entire milestone is done
	if logged >= est && req.MilestoneID != "" {
		var remaining int
		_ = db.QueryRow(`SELECT COUNT(*) FROM tasks WHERE milestone_id = ? AND logged_mins < estimate_mins`, req.MilestoneID).Scan(&remaining)
		if remaining == 0 {
			_ = sendPushToUser(r.Context(), req.UserID, map[string]any{
				"title":       "Milestone complete ",
				"body":        "You’ve completed all tasks for a milestone.",
				"kind":        "milestone",
				"milestoneId": req.MilestoneID,
				"goalId":      req.GoalID,
			})
		}
	}

	w.WriteHeader(204)
}

func sendPushToUser(ctx context.Context, userID string, payload map[string]any) error {
	rows, err := db.Query(`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`, userID)
	if err != nil {
		return err
	}
	defer rows.Close()

	msg, _ := json.Marshal(payload)
	for rows.Next() {
		var ep, p256, auth string
		if err := rows.Scan(&ep, &p256, &auth); err != nil {
			continue
		}

		sub := &webpush.Subscription{
			Endpoint: ep,
			Keys: webpush.Keys{
				P256dh: p256,
				Auth:   auth,
			},
		}

		resp, err := webpush.SendNotification(msg, sub, webpushOpts)
		if err != nil || (resp != nil && (resp.StatusCode == 404 || resp.StatusCode == 410)) {
			// delete dead subscription
			_, _ = db.Exec(`DELETE FROM push_subscriptions WHERE endpoint = ?`, ep)
			continue
		}
		if resp != nil {
			_ = resp.Body.Close()
		}
	}
	return nil
}

func coalesce(s, def string) string {
	if strings.TrimSpace(s) == "" {
		return def
	}
	return s
}
func max1(v int) int {
	if v <= 0 {
		return 1
	}
	return v
}
func itoa(i int) string { return strconv.Itoa(i) }
