#if UNITY_EDITOR || UNITY_SERVER
using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
namespace Buklod.Empire {
    // Dedicated server only. Auth verifies the bearer; player IDs in the request
    // body or user_metadata are never accepted. No service_role key is required.
    public sealed class SupabaseMatchIdentityVerifier:IMatchIdentityVerifier,IDisposable {
        readonly HttpClient client;readonly Uri endpoint;readonly string publishable;
        [Serializable] sealed class User {public string id,role;public bool is_anonymous;}
        public SupabaseMatchIdentityVerifier(Uri isolatedProject,string publishableKey){
            if(isolatedProject==null||isolatedProject.Scheme!="https"||!isolatedProject.IsDefaultPort||
               !isolatedProject.Host.EndsWith(".supabase.co",StringComparison.OrdinalIgnoreCase)||
               isolatedProject.Host.Split('.').Length!=3||isolatedProject.Host.Equals("yhanxndaqbmuzbdqlblu.supabase.co",StringComparison.OrdinalIgnoreCase)||
               isolatedProject.AbsolutePath!="/"||!string.IsNullOrEmpty(isolatedProject.Query)||!string.IsNullOrEmpty(isolatedProject.Fragment)||!string.IsNullOrEmpty(isolatedProject.UserInfo))
                throw new ArgumentException("Use an explicit non-MAIN isolated Auth project.");
            if(string.IsNullOrWhiteSpace(publishableKey)||!publishableKey.StartsWith("sb_publishable_",StringComparison.Ordinal)||publishableKey.Length>512)
                throw new ArgumentException("An isolated project publishable key is required.");
            endpoint=new Uri(isolatedProject,"auth/v1/user");publishable=publishableKey;
            client=new HttpClient(new HttpClientHandler{AllowAutoRedirect=false,UseCookies=false}){Timeout=TimeSpan.FromSeconds(5)};
        }
        public async Task<string> VerifyAccountAsync(string bearer,CancellationToken cancellation){
            if(string.IsNullOrWhiteSpace(bearer)||bearer.Length>8192||bearer.IndexOfAny(new[]{'\r','\n',' '})>=0)return null;
            using(var deadline=CancellationTokenSource.CreateLinkedTokenSource(cancellation)){
                deadline.CancelAfter(TimeSpan.FromSeconds(5));
                using(var request=new HttpRequestMessage(HttpMethod.Get,endpoint)){
                    request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",bearer);
                    request.Headers.Add("apikey",publishable);
                    using(var response=await client.SendAsync(request,HttpCompletionOption.ResponseHeadersRead,deadline.Token)){
                        if(response.StatusCode!=HttpStatusCode.OK)return null;
                        const int max=32768;if(response.Content.Headers.ContentLength>max)return null;
                        using(var stream=await response.Content.ReadAsStreamAsync())using(var output=new MemoryStream()){
                            var buffer=new byte[4096];int n;
                            while((n=await stream.ReadAsync(buffer,0,buffer.Length,deadline.Token))>0){if(output.Length+n>max)return null;output.Write(buffer,0,n);}
                            User user;try{user=JsonUtility.FromJson<User>(new UTF8Encoding(false,true).GetString(output.ToArray()));}catch(ArgumentException){return null;}
                            return user!=null&&!user.is_anonymous&&user.role=="authenticated"&&Guid.TryParseExact(user.id,"D",out var id)&&id!=Guid.Empty?id.ToString("D"):null;
                        }
                    }
                }
            }
        }
        public void Dispose(){client.Dispose();}
    }
}
#endif
