package expo.modules.buklodgenesisplayupdates

import android.app.Activity
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Optional binary-level Google Play update bridge.
 * Never initiates a Play flow on staging, sideloaded clients or by itself.
 * A caller must separately verify the signed server minimum-version policy and
 * the replacement's availability on Google Play. No update means no lockout.
 */
class BuklodGenesisPlayUpdateModule : Module() {
  private val launchInProgress = AtomicBoolean(false)
  private val requestCode = 0x4B36
  private val productionPackage = "org.mzbministry.buklod"

  override fun definition() = ModuleDefinition {
    Name("BuklodGenesisPlayUpdates")
    Events("onImmediateUpdateResult")

    AsyncFunction("checkPlayUpdate") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null || activity.isFinishing || activity.isDestroyed ||
          activity.packageName != productionPackage) {
        promise.resolve(mapOf("supported" to false, "available" to false,
          "immediateAllowed" to false, "availableVersionCode" to 0))
      } else {
        try {
          val manager = AppUpdateManagerFactory.create(activity)
          manager.appUpdateInfo
            .addOnSuccessListener(activity) { info ->
              val availability = info.updateAvailability()
              promise.resolve(mapOf(
                "supported" to true,
                "available" to (availability == UpdateAvailability.UPDATE_AVAILABLE ||
                  availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS),
                "immediateAllowed" to info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
                "availableVersionCode" to info.availableVersionCode(),
                "updateAvailability" to availability
              ))
            }
            .addOnFailureListener(activity) {
              // No unverified lockout: caller may show a regular Play link.
              promise.resolve(mapOf("supported" to false, "available" to false,
                "immediateAllowed" to false, "availableVersionCode" to 0))
            }
        } catch (_: Exception) {
          promise.resolve(mapOf("supported" to false, "available" to false,
            "immediateAllowed" to false, "availableVersionCode" to 0))
        }
      }
    }

    AsyncFunction("startImmediateUpdate") { requiredVersionCode: Int, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null || activity.isFinishing || activity.isDestroyed ||
          activity.packageName != productionPackage || requiredVersionCode < 1) {
        promise.resolve(false)
      } else if (!launchInProgress.compareAndSet(false, true)) {
        promise.resolve(false)
      } else {
        try {
          val manager = AppUpdateManagerFactory.create(activity)
          manager.appUpdateInfo
            .addOnSuccessListener(activity) { info ->
              val status = info.updateAvailability()
              val available = (status == UpdateAvailability.UPDATE_AVAILABLE ||
                status == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS)
              if (!available || info.availableVersionCode() < requiredVersionCode ||
                  !info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                launchInProgress.set(false)
                promise.resolve(false)
              } else {
                try {
                  val launched = manager.startUpdateFlowForResult(
                    info, activity,
                    AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
                    requestCode
                  )
                  if (!launched) launchInProgress.set(false)
                  promise.resolve(launched)
                } catch (_: Exception) {
                  launchInProgress.set(false)
                  promise.resolve(false)
                }
              }
            }
            .addOnFailureListener(activity) {
              launchInProgress.set(false)
              promise.resolve(false)
            }
        } catch (_: Exception) {
          launchInProgress.set(false)
          promise.resolve(false)
        }
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == requestCode) {
        launchInProgress.set(false)
        sendEvent("onImmediateUpdateResult", mapOf(
          "resultCode" to payload.resultCode,
          "completed" to (payload.resultCode == Activity.RESULT_OK)
        ))
      }
    }

    OnActivityDestroys {
      launchInProgress.set(false)
    }
  }
}
