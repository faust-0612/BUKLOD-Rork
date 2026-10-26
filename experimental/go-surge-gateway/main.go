package main
import (
 "context"
 "encoding/json"
 "log"
 "net/http"
 "net/url"
 "os"
 "strconv"
 "strings"
 "sync/atomic"
 "time"
)
type server struct {slots chan struct{}; inflight atomic.Int64; upstream string; anonKey string; client *http.Client}
func (s *server) admit(w http.ResponseWriter, fn func()) {
 select {case s.slots<-struct{}{}:s.inflight.Add(1);defer func(){<-s.slots;s.inflight.Add(-1)}();fn()
 default:w.Header().Set("Retry-After","1");http.Error(w,"overloaded",http.StatusServiceUnavailable)}
}
func (s *server) handle(w http.ResponseWriter,r *http.Request) {
 s.admit(w,func(){select{case <-time.After(50*time.Millisecond):w.WriteHeader(http.StatusNoContent);case <-r.Context().Done():return}})
}
// Auth connectivity only: validates bearer tokens with existing Supabase Auth.
// No database queries, credentials in logs, privileged key, or user details returned.
func (s *server) authCheck(w http.ResponseWriter,r *http.Request){
 if s.upstream==""||s.anonKey==""{http.Error(w,"not configured",http.StatusServiceUnavailable);return}
 authorization:=r.Header.Get("Authorization")
 if !strings.HasPrefix(authorization,"Bearer ")||len(strings.TrimSpace(strings.TrimPrefix(authorization,"Bearer ")))==0{http.Error(w,"missing bearer",http.StatusUnauthorized);return}
 s.admit(w,func(){
  ctx,cancel:=context.WithTimeout(r.Context(),3*time.Second);defer cancel()
  req,err:=http.NewRequestWithContext(ctx,http.MethodGet,s.upstream+"/auth/v1/user",nil)
  if err!=nil{http.Error(w,"upstream unavailable",http.StatusBadGateway);return}
  req.Header.Set("Authorization",authorization);req.Header.Set("apikey",s.anonKey)
  resp,err:=s.client.Do(req)
  if err!=nil{http.Error(w,"upstream unavailable",http.StatusBadGateway);return}
  defer resp.Body.Close()
  if resp.StatusCode==http.StatusOK{w.WriteHeader(http.StatusNoContent);return}
  if resp.StatusCode==http.StatusUnauthorized||resp.StatusCode==http.StatusForbidden{http.Error(w,"unauthorized",http.StatusUnauthorized);return}
  http.Error(w,"upstream unavailable",http.StatusBadGateway)
 })
}
func (s *server) routes() http.Handler{
 m:=http.NewServeMux()
 m.HandleFunc("GET /healthz",func(w http.ResponseWriter,r *http.Request){w.Header().Set("Content-Type","application/json");_ = json.NewEncoder(w).Encode(map[string]any{"status":"ok","inflight":s.inflight.Load()})})
 m.HandleFunc("GET /simulate",s.handle)
 m.HandleFunc("GET /auth-check",s.authCheck)
 return m
}
func main(){
 n,_:=strconv.Atoi(os.Getenv("MAX_INFLIGHT"));if n<1{n=64}
 raw:=strings.TrimRight(os.Getenv("SUPABASE_URL"),"/")
 if raw!=""{u,err:=url.Parse(raw);if err!=nil||u.Scheme!="https"||u.Host==""||u.User!=nil||u.RawQuery!=""||u.Fragment!=""||u.Path!=""{log.Fatal("SUPABASE_URL must be HTTPS origin")}}
 s:=&server{slots:make(chan struct{},n),upstream:raw,anonKey:os.Getenv("SUPABASE_ANON_KEY"),client:&http.Client{Timeout:3*time.Second}}
 srv:=&http.Server{Addr:":8089",Handler:s.routes(),ReadHeaderTimeout:3*time.Second,ReadTimeout:10*time.Second,WriteTimeout:10*time.Second,IdleTimeout:30*time.Second}
 log.Fatal(srv.ListenAndServe())
}
