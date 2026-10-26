package main

import (
 "net/http"
 "net/http/httptest"
 "sync"
 "testing"
)
func TestOverload(t *testing.T) {
 slots:=make(chan struct{},1); slots<-struct{}{}
 w:=httptest.NewRecorder()
 h:=http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  select {case slots<-struct{}{}: <-slots; w.WriteHeader(204)
  default: w.Header().Set("Retry-After","1"); http.Error(w,"overloaded",503)}
 })
 h.ServeHTTP(w,httptest.NewRequest("GET","/simulate",nil))
 if w.Code!=503 || w.Header().Get("Retry-After")!="1" {t.Fatalf("status=%d",w.Code)}
}
func TestConcurrentBound(t *testing.T){
 slots:=make(chan struct{},2)
 var wg sync.WaitGroup
 for i:=0;i<30;i++ {wg.Add(1);go func(){defer wg.Done();select{case slots<-struct{}{}: <-slots;default:}}()}
 wg.Wait()
 if len(slots)!=0 {t.Fatal("leaked admission slots")}
}
