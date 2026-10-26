package main
import ("encoding/json";"log";"net/http";"os";"strconv";"sync/atomic";"time")
type server struct { slots chan struct{}; inflight atomic.Int64 }
func (s *server) handle(w http.ResponseWriter,r *http.Request) {
 select {case s.slots<-struct{}{}:s.inflight.Add(1);defer func(){<-s.slots;s.inflight.Add(-1)}()
 default:w.Header().Set("Retry-After","1");http.Error(w,"overloaded",http.StatusServiceUnavailable);return}
 select {case <-time.After(50*time.Millisecond):w.WriteHeader(http.StatusNoContent);case <-r.Context().Done():return}
}
func (s *server) routes() http.Handler {
 m:=http.NewServeMux()
 m.HandleFunc("GET /healthz",func(w http.ResponseWriter,r *http.Request){w.Header().Set("Content-Type","application/json");_ = json.NewEncoder(w).Encode(map[string]any{"status":"ok","inflight":s.inflight.Load()})})
 m.HandleFunc("GET /simulate",s.handle);return m
}
func main(){n,_:=strconv.Atoi(os.Getenv("MAX_INFLIGHT"));if n<1{n=64};s:=&server{slots:make(chan struct{},n)};srv:=&http.Server{Addr:":8089",Handler:s.routes(),ReadHeaderTimeout:3*time.Second,ReadTimeout:10*time.Second,WriteTimeout:10*time.Second,IdleTimeout:30*time.Second};log.Fatal(srv.ListenAndServe())}
