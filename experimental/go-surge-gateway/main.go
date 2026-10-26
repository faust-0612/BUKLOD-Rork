// Standalone surge-control prototype. Not wired into BUKLOD production routes.
// Run: go run ./experimental/go-surge-gateway
package main

import (
 "encoding/json"
 "log"
 "net/http"
 "os"
 "strconv"
 "sync/atomic"
 "time"
)

func envInt(key string, fallback int) int {
 n, err := strconv.Atoi(os.Getenv(key))
 if err != nil || n < 1 { return fallback }
 return n
}

func main() {
 limit := envInt("MAX_INFLIGHT", 64)
 slots := make(chan struct{}, limit)
 var inflight atomic.Int64
 mux := http.NewServeMux()
 mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
  w.Header().Set("Content-Type", "application/json")
  _ = json.NewEncoder(w).Encode(map[string]any{"status":"ok","inflight":inflight.Load()})
 })
 // Demonstrates bounded admission; deliberately does not proxy user requests,
 // handle credentials, or connect to production Supabase.
 mux.HandleFunc("GET /simulate", func(w http.ResponseWriter, r *http.Request) {
  select {
  case slots <- struct{}{}:
   inflight.Add(1)
   defer func(){ <-slots; inflight.Add(-1) }()
  default:
   w.Header().Set("Retry-After","1")
   http.Error(w,"overloaded",http.StatusServiceUnavailable)
   return
  }
  select {
  case <-time.After(50*time.Millisecond):
   w.WriteHeader(http.StatusNoContent)
  case <-r.Context().Done():
   return
  }
 })
 srv := &http.Server{
  Addr:":8089",Handler:mux,ReadHeaderTimeout:3*time.Second,
  ReadTimeout:10*time.Second,WriteTimeout:10*time.Second,
  IdleTimeout:30*time.Second,
 }
 log.Printf("isolated surge prototype listening on %s, max_inflight=%d",srv.Addr,limit)
 log.Fatal(srv.ListenAndServe())
}
