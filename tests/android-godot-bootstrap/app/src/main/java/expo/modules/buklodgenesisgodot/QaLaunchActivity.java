package expo.modules.buklodgenesisgodot;
import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import java.io.*;
import java.security.MessageDigest;
/** Test-only isolated package. Never included in the full BUKLOD APK. */
public final class QaLaunchActivity extends Activity {
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  String world=getIntent().getStringExtra("world");
  String source=getIntent().getStringExtra("source");
  new Thread(()->{
   try {
    File pack=null;
    if("ota".equals(source)||"rejected".equals(source)){
     File dir=new File(getFilesDir(),"buklod-genesis-approved-packs");
     if(!dir.exists()&&!dir.mkdirs())throw new IOException("private storage");
     File tmp=new File(dir,"qa.tmp");
     MessageDigest md=MessageDigest.getInstance("SHA-256");
     try(InputStream in=getAssets().open("qa-content.zip"); FileOutputStream out=new FileOutputStream(tmp)){
      byte[] buf=new byte[32768]; int n;
      while((n=in.read(buf))!=-1){out.write(buf,0,n);md.update(buf,0,n);}
      out.getFD().sync();
     }
     StringBuilder digest=new StringBuilder();for(byte b:md.digest())digest.append(String.format("%02x",b&255));
     pack=new File(dir,digest.toString()+".zip");
     if(pack.exists()&&!pack.delete())throw new IOException("stale test file");
     if(!tmp.renameTo(pack))throw new IOException("copy failed");
     if("rejected".equals(source))pack=new File(dir,"noncanonical.zip");
    }
    final android.content.Intent intent=GenesisGodotActivity.launchIntent(this,world,pack);
    runOnUiThread(()->{startActivity(intent);finish();});
   }catch(Exception e){Log.e("BUKLOD_QA","Launch setup failed",e);finish();}
  }).start();
 }
}
