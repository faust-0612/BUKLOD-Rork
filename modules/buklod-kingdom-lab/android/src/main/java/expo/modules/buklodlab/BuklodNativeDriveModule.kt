package expo.modules.buklodlab

import android.app.Activity
import android.content.IntentSender
import android.os.Handler
import android.os.Looper
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Native QA only: Google Play Services authorization for one user-initiated
 * Drive action. Never stores a refresh token or calls BUKLOD backend.
 * The short-lived access token is returned to JS memory for direct Drive API
 * requests. JavaScript must verify Google subject against the signed-in
 * BUKLOD account's secure local binding before ANY Drive request.
 */
class BuklodNativeDriveModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val requestCode = 0x4B21
  private val scope = "https://www.googleapis.com/auth/drive.file"
  private val emailScope = "https://www.googleapis.com/auth/userinfo.email"
  private var waiting: Promise? = null
  private var lastToken: String? = null
  private val timeout = Runnable {
    fail("Google Drive authorization timed out. Your local notes were not changed.")
  }

  private fun fail(message: String) {
    mainHandler.removeCallbacks(timeout)
    val callback = waiting ?: return
    waiting = null
    callback.reject("E_BUKLOD_DRIVE", message, null)
  }

  private fun complete(result: AuthorizationResult) {
    val callback = waiting ?: return
    val token = result.accessToken
    if (token.isNullOrEmpty() || !result.grantedScopes.contains(scope) ||
      !result.grantedScopes.contains(emailScope)) {
      fail("Drive and account identity permissions were not granted.")
      return
    }
    mainHandler.removeCallbacks(timeout)
    waiting = null
    lastToken = token
    callback.resolve(mapOf("accessToken" to token))
  }

  override fun definition() = ModuleDefinition {
    Name("BuklodNativeDrive")

    AsyncFunction("authorizeDrive") { promise: Promise ->
      mainHandler.post {
        if (waiting != null) {
          promise.reject("E_BUKLOD_DRIVE_BUSY", "A Google authorization is already open.", null)
          return@post
        }
        val activity = appContext.currentActivity
        if (activity == null || activity.isFinishing || activity.isDestroyed) {
          promise.reject("E_BUKLOD_DRIVE_ACTIVITY", "Open BUKLOD before connecting Drive.", null)
          return@post
        }
        waiting = promise
        mainHandler.postDelayed(timeout, 90000)
        val request = AuthorizationRequest.builder()
          .setRequestedScopes(listOf(Scope(scope), Scope(emailScope)))
          .build()
        try {
          Identity.getAuthorizationClient(activity).authorize(request)
            .addOnSuccessListener(activity) { result ->
              if (waiting == null) return@addOnSuccessListener
              try {
                if (result.hasResolution()) {
                  val resolution = result.pendingIntent
                    ?: throw IllegalStateException("Drive authorization returned no resolution")
                  activity.startIntentSenderForResult(resolution.intentSender,
                    requestCode, null, 0, 0, 0)
                } else {
                  complete(result)
                }
              } catch (error: IntentSender.SendIntentException) {
                fail("Unable to open Google Drive consent screen.")
              } catch (error: Exception) {
                fail("Google Drive authorization could not be completed.")
              }
            }
            .addOnFailureListener(activity) {
              fail("Google Drive is unavailable or authorization was denied.")
            }
        } catch (error: Exception) {
          fail("Google Drive authorization cannot start on this device.")
        }
      }
    }

    OnActivityResult { activity, payload ->
      if (payload.requestCode == requestCode && waiting != null) {
        if (payload.resultCode != Activity.RESULT_OK || payload.data == null) {
          fail("Google Drive access was canceled.")
        } else {
          try {
            val result = Identity.getAuthorizationClient(activity)
              .getAuthorizationResultFromIntent(payload.data!!)
            complete(result)
          } catch (error: Exception) {
            fail("Google Drive authorization could not be verified.")
          }
        }
      }
    }

    AsyncFunction("clearDriveToken") { promise: Promise ->
      mainHandler.post {
        fail("Google Drive connection was closed.")
        val token = lastToken
        lastToken = null
        val activity = appContext.currentActivity
        if (token.isNullOrEmpty() || activity == null) {
          promise.resolve(true)
        } else {
          val request = ClearTokenRequest.builder().setToken(token).build()
          Identity.getAuthorizationClient(activity).clearToken(request)
            .addOnSuccessListener { promise.resolve(true) }
            .addOnFailureListener {
              // Caller must not claim a successful disconnect if token cache
              // could not be cleared; JS still discards its own credentials.
              promise.reject("E_BUKLOD_DRIVE_CLEAR", "Google token cache could not be cleared.", null)
            }
        }
      }
    }

    OnActivityDestroys {
      fail("Google authorization was interrupted because the screen closed.")
      lastToken = null
    }
  }
}
