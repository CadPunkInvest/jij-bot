package com.jijbot.android

import androidx.work.*
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.concurrent.TimeUnit

@CapacitorPlugin(name = "BotWorker")
class BotWorkerPlugin : Plugin() {

    @PluginMethod
    fun start(call: PluginCall) {
        val request = PeriodicWorkRequestBuilder<BotWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setInitialDelay(1, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork("jij-bot-worker", ExistingPeriodicWorkPolicy.KEEP, request)
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        WorkManager.getInstance(context).cancelUniqueWork("jij-bot-worker")
        call.resolve()
    }
}
