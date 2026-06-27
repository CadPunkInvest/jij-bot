package com.jijbot.android

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "EncryptedKeyStore")
class EncryptedKeyStorePlugin : Plugin() {

    @PluginMethod
    fun storeKey(call: PluginCall) {
        val keyBase64 = call.getString("key") ?: run { call.reject("key required"); return }
        try {
            getEncryptedPrefs(context).edit().putString(WALLET_KEY, keyBase64).apply()
            call.resolve()
        } catch (e: Exception) {
            call.reject("storeKey failed: ${e.message}")
        }
    }

    @PluginMethod
    fun clearKey(call: PluginCall) {
        try {
            getEncryptedPrefs(context).edit().remove(WALLET_KEY).apply()
            call.resolve()
        } catch (e: Exception) {
            call.reject("clearKey failed: ${e.message}")
        }
    }

    companion object {
        const val WALLET_KEY = "wallet_secret_key"

        fun getEncryptedPrefs(context: Context): SharedPreferences {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            return EncryptedSharedPreferences.create(
                context,
                "jij_secure_wallet",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }
    }
}
