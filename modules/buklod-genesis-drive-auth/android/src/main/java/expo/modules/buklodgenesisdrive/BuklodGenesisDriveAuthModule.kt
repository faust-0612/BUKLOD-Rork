package expo.modules.buklodgenesisdrive

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
 * Isolated native OAuth consent only. Never accesses Google Drive or BUKLOD data.
 * No cached refresh token, no access-token persistence or UI auto-launch.
 *
 * Access tokens are unbound until the JS account layer independently verifies
 * Google subject against the active BUKLOD account. Never call Drive before that.
 */
class BuklodGenesisDriveAuthModule : Module() {
  private val handler = Handler(Looper.getMainLooper())
  private val requestCode = 0x4B24
  private val driveFileScope = "https://www.googleapis.com/auth/drive.file"
  private val identityScope = "openid"
  private val emailScope = "https://www.googleapis.com/auth/userinfo.email"
  private var waiting: Promise? = null
  private var pendingBuklodUserId: String? = null
  private var token: String? = null
  private val timeout = Runnable { fail("Google Drive consent timed out.") }

  private fun fail(message: String) {
    handler.removeCallbacks(timeout)
    pendingBuklodUserId = null
    val callback = waiting ?: return
    waiting = null
    callback.reject("E_GENESIS_DRIVE_CONSENT", message, null)
  }

  private fun complete(result: AuthorizationResult) {
    val callback = waiting ?: return
    val account = pendingBuklodUserId ?: run {
      fail("BUKLOD account changed during consent.")
      return
    }
    val accessToken = result.accessToken
    if (accessToken.isNullOrBlank() ||
        !result.grantedScopes.contains(driveFileScope) ||
        !result.grantedScopes.contains(identityScope) ||
        !result.grantedScopes.contains(emailScope)) {
      fail("Required least-privilege Drive and identity scopes were not granted.")
      return
    }
    handler.removeCallbacks(timeout)
    waiting = null
    pendingBuklodUserId = null
    token = accessToken
    // Do NOT claim a verified subject here. No Drive API request is authorized yet.
    callback.resolve(mapOf(
      "accessToken" to accessToken,
      "expectedBuklodUserId" to account,
      "requiresIdentityVerification" to true,
      "scopes" to listOf(driveFileScope, identityScope, emailScope)
    ))
  }

  override fun definition() = ModuleDefinition {
    Name("BuklodGenesisDriveAuth")

    AsyncFunction("beginUserDriveConsent") { buklodUserId: String, promise: Promise ->
      handler.post {
        val activity = appContext.currentActivity
        if (activity == null || activity.isFinishing || activity.isDestroyed ||
            activity.packageName != "org.mzbministry.buklod.staging" ||
            buklodUserId.isBlank() || buklodUserId.length > 128) {
          promise.reject("E_GENESIS_DRIVE_CONTEXT", "A signed-in Genesis staging account is required.", null)
          return@post
        }
        if (waiting != null) {
          promise.reject("E_GENESIS_DRIVE_BUSY", "A Google Drive consent request is already open.", null)
          return@post
        }
        token = null
        waiting = promise
        pendingBuklodUserId = buklodUserId
        handler.postDelayed(timeout, 90_000)
        try {
          val request = AuthorizationRequest.builder()
            .setRequestedScopes(listOf(
              Scope(driveFileScope), Scope(identityScope), Scope(emailScope)
            ))
            .setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT)
            .build()
          Identity.getAuthorizationClient(activity).authorize(request)
            .addOnSuccessListener(activity) { result ->
              if (waiting == null) return@addOnSuccessListener
              try {
                if (result.hasResolution()) {
                  val resolution = result.pendingIntent
                    ?: throw IllegalStateException("Google authorization missing resolution")
                  activity.startIntentSenderForResult(
                    resolution.intentSender, requestCode, null, 0, 0, 0
                  )
                } else {
                  complete(result)
                }
              } catch (_: IntentSender.SendIntentException) {
                fail("Google account picker could not start.")
              } catch (_: Exception) {
                fail("Google authorization could not continue.")
              }
            }
            .addOnFailureListener(activity) {
              fail("Google Drive consent was denied or unavailable.")
            }
        } catch (_: Exception) {
          fail("Google authorization is unavailable on this device.")
        }
      }
    }

    OnActivityResult { activity, payload ->
      if (payload.requestCode == requestCode && waiting != null) {
        if (payload.resultCode != Activity.RESULT_OK || payload.data == null) {
          fail("Google Drive authorization was cancelled.")
        } else {
          try {
            val result = Identity.getAuthorizationClient(activity)
              .getAuthorizationResultFromIntent(payload.data!!)
            complete(result)
          } catch (_: Exception) {
            fail("Could not verify Google authorization result.")
          }
        }
      }
    }

    AsyncFunction("disconnectDriveAuth") { promise: Promise ->
      handler.post {
        fail("Drive authorization was disconnected.")
        val previous = token
        token = null
        val activity = appContext.currentActivity
        if (previous.isNullOrBlank() || activity == null) {
          promise.resolve(true)
        } else {
          val request = ClearTokenRequest.builder().setToken(previous).build()
          Identity.getAuthorizationClient(activity).clearToken(request)
            .addOnSuccessListener { promise.resolve(true) }
            .addOnFailureListener {
              promise.reject("E_GENESIS_DRIVE_CLEAR", "Google token revocation could not be verified.", null)
            }
        }
      }
    }

    OnActivityDestroys {
      fail("Google Drive consent ended because the screen closed.")
      token = null
    }
  }
}
