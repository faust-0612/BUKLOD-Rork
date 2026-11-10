package main
import ("net/http/httptest";"sync";"testing")
func TestOverload(t *testing.T){s:=&server{slots:make(chan struct{},1)};s.slots<-struct{}{};w:=httptest.NewRecorder();s.routes().ServeHTTP(w,httptest.NewRequest("GET","/simulate",nil));if w.Code!=503||w.Header().Get("Retry-After")!="1"{t.Fatalf("code=%d",w.Code)}}
func TestHealth(t *testing.T){s:=&server{slots:make(chan struct{},1)};w:=httptest.NewRecorder();s.routes().ServeHTTP(w,httptest.NewRequest("GET","/healthz",nil));if w.Code!=200{t.Fatal(w.Code)}}
func TestConcurrent(t *testing.T){s:=&server{slots:make(chan struct{},2)};var wg sync.WaitGroup;for i:=0;i<30;i++{wg.Add(1);go func(){defer wg.Done();w:=httptest.NewRecorder();s.routes().ServeHTTP(w,httptest.NewRequest("GET","/simulate",nil));if w.Code!=204&&w.Code!=503{t.Errorf("unexpected %d",w.Code)}}()};wg.Wait();if s.inflight.Load()!=0{t.Fatal("leaked slots")}}

func TestAuthCheckMissingConfig(t *testing.T){s:=&server{slots:make(chan struct{},1)};w:=httptest.NewRecorder();s.routes().ServeHTTP(w,httptest.NewRequest("GET","/auth-check",nil));if w.Code!=503{t.Fatal(w.Code)}}
func TestAuthCheckMissingBearer(t *testing.T){s:=&server{slots:make(chan struct{},1),upstream:"https://example.invalid",anonKey:"public-test-key"};w:=httptest.NewRecorder();s.routes().ServeHTTP(w,httptest.NewRequest("GET","/auth-check",nil));if w.Code!=401{t.Fatal(w.Code)}}
