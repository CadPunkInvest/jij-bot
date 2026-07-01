package com.jijbot.android

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Base64
import androidx.core.app.NotificationCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class BotWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        return try {
            val capPrefs = applicationContext.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)

            // Skip if JS bot polled recently — app is active in foreground
            val lastJsPoll = capPrefs.getString("jij-last-poll-time", "0")?.toLongOrNull() ?: 0L
            if (System.currentTimeMillis() - lastJsPoll < 30_000L) return Result.success()

            val stateJson = capPrefs.getString("jij-bot-state", null) ?: return Result.success()
            val state = JSONObject(stateJson)
            if (!state.optBoolean("botRunning", false)) return Result.success()

            val price = fetchJiJPrice() ?: return Result.retry()

            checkGridFormatSwitch(state, price)

            val openOrders = state.getJSONArray("openOrders")
            var filled = false

            for (i in 0 until openOrders.length()) {
                val order = openOrders.getJSONObject(i)
                if (order.getBoolean("filled")) continue
                val orderPrice = order.getDouble("price")
                val side = order.getString("side")
                val quantity = order.getDouble("quantity")
                val shouldFill = if (side == "buy") price <= orderPrice else price >= orderPrice
                if (!shouldFill) continue

                val walletKey = state.optString("walletPublicKey") ?: continue
                val slippage = state.optJSONObject("config")?.optInt("slippageBps", 500) ?: 500

                if (executeSwap(side, quantity, orderPrice, walletKey, slippage)) {
                    order.put("filled", true)
                    order.put("timestamp", System.currentTimeMillis())
                    filled = true
                    notify("Grid Fill", "${if (side == "buy") "Bought" else "Sold"} ${quantity.toLong()} JiJ @ $orderPrice SOL")
                }
            }

            // Always update lastPollTime so the app UI shows an accurate "last sweep" time
            val now = System.currentTimeMillis()
            state.put("lastPollTime", now)
            capPrefs.edit()
                .putString("jij-last-poll-time", now.toString())
                .putString("jij-bot-state", state.toString())
                .apply()

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    // Mirrors packages/core/src/gridFormatBot.ts checkGridFormatSwitches — nothing rests on an
    // exchange, so a format switch is just discarding and rebuilding the in-memory order array.
    private fun checkGridFormatSwitch(state: JSONObject, currentPrice: Double) {
        val switchTimes = state.optJSONArray("gridFormatSwitchTimes") ?: return
        val switchExecuted = state.optJSONArray("gridFormatSwitchExecuted") ?: return
        if (switchTimes.length() < 3 || switchExecuted.length() < 3) return

        val now = System.currentTimeMillis()
        for (i in 0 until 3) {
            val dueAt = switchTimes.getLong(i)
            val executed = switchExecuted.getBoolean(i)
            if (!executed && dueAt > 0 && now >= dueAt) {
                rebuildGridWithNewFormat(state, currentPrice)
                switchExecuted.put(i, true)
            }
        }
    }

    private fun rebuildGridWithNewFormat(state: JSONObject, currentPrice: Double) {
        val config = state.optJSONObject("config") ?: return
        val currentLevels = config.optInt("gridLevels", GRID_DENSITIES[0])
        val candidates = GRID_DENSITIES.filter { it != currentLevels }
        val newLevels = candidates[(Math.random() * candidates.size).toInt()]

        val gridLower = config.optDouble("gridLower", 0.0)
        val gridUpper = config.optDouble("gridUpper", 0.0)
        if (gridLower <= 0.0 || gridUpper <= 0.0) return
        val gridReserve = state.optDouble("gridReserve", 0.0)

        config.put("gridLevels", newLevels)
        state.put("gridLevels", newLevels)
        val gridStep = (gridUpper - gridLower) / newLevels
        state.put("gridStep", gridStep)
        val buyLevels = newLevels / 2
        val midPrice = (gridLower + gridUpper) / 2
        val quantityPerGrid = if (buyLevels > 0) gridReserve / buyLevels / midPrice else 0.0
        state.put("quantityPerGrid", quantityPerGrid)

        val newOrders = JSONArray()
        for (level in 0..newLevels) {
            val orderPrice = gridLower + level * gridStep
            val side = if (orderPrice < currentPrice) "buy" else "sell"
            val order = JSONObject().apply {
                put("id", java.util.UUID.randomUUID().toString())
                put("level", level)
                put("price", orderPrice)
                put("side", side)
                put("quantity", quantityPerGrid)
                put("filled", false)
                put("timestamp", System.currentTimeMillis())
            }
            newOrders.put(order)
        }
        state.put("openOrders", newOrders)
    }

    private fun fetchJiJPrice(): Double? {
        val json = httpGet("$PROXY/dexscreener/tokens/$JIJ_MINT") ?: return null
        val pairs = JSONObject(json).optJSONArray("pairs") ?: return null
        if (pairs.length() == 0) return null
        return pairs.getJSONObject(0).getString("priceNative").toDoubleOrNull()
    }

    private fun executeSwap(
        side: String, quantity: Double, orderPrice: Double,
        walletPublicKey: String, slippageBps: Int
    ): Boolean {
        val inputMint = if (side == "buy") SOL_MINT else JIJ_MINT
        val outputMint = if (side == "buy") JIJ_MINT else SOL_MINT
        val amount = if (side == "buy") (quantity * orderPrice * 1e9).toLong()
                     else (quantity * 1e9).toLong()
        if (amount <= 0) return false

        val quoteJson = httpGet("$PROXY/swap/v1/quote?inputMint=$inputMint&outputMint=$outputMint&amount=$amount&slippageBps=$slippageBps")
            ?: return false
        val quote = JSONObject(quoteJson)
        if (quote.has("error") || !quote.has("outAmount")) return false

        val swapBody = JSONObject().apply {
            put("quoteResponse", quote)
            put("userPublicKey", walletPublicKey)
            put("wrapAndUnwrapSol", true)
            put("dynamicComputeUnitLimit", true)
            put("prioritizationFeeLamports", 50000)
        }
        val swapJson = httpPost("$PROXY/swap/v1/swap", swapBody.toString()) ?: return false
        val swapData = JSONObject(swapJson)
        val txBase64 = swapData.optString("swapTransaction").takeIf { it.isNotEmpty() } ?: return false

        val secretKey = getSecretKey() ?: return false
        val txBytes = Base64.decode(txBase64, Base64.DEFAULT)
        val signedTx = signTransaction(txBytes, secretKey)
        val txEncoded = Base64.encodeToString(signedTx, Base64.NO_WRAP)

        val rpcBody = JSONObject().apply {
            put("jsonrpc", "2.0"); put("id", 1); put("method", "sendTransaction")
            put("params", JSONArray().put(txEncoded).put(JSONObject()
                .put("encoding", "base64").put("skipPreflight", false).put("maxRetries", 3)))
        }
        val rpcResult = httpPost(RPC, rpcBody.toString()) ?: return false
        return !JSONObject(rpcResult).has("error")
    }

    private fun signTransaction(txBytes: ByteArray, secretKey: ByteArray): ByteArray {
        // Versioned transaction layout: [0x01 num_sigs][64 bytes sig][message...]
        // sig slot starts at byte 1, message starts at byte 65
        val messageBytes = txBytes.copyOfRange(65, txBytes.size)
        val signer = Ed25519Signer()
        signer.init(true, Ed25519PrivateKeyParameters(secretKey.copyOfRange(0, 32), 0))
        signer.update(messageBytes, 0, messageBytes.size)
        signer.generateSignature().copyInto(txBytes, 1)
        return txBytes
    }

    private fun getSecretKey(): ByteArray? {
        val b64 = EncryptedKeyStorePlugin.getEncryptedPrefs(applicationContext)
            .getString(EncryptedKeyStorePlugin.WALLET_KEY, null) ?: return null
        return Base64.decode(b64, Base64.DEFAULT)
    }

    private fun httpGet(urlStr: String): String? = try {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.setRequestProperty("Accept", "application/json")
        conn.connectTimeout = 10_000; conn.readTimeout = 10_000
        if (conn.responseCode == 200) conn.inputStream.bufferedReader().readText() else null
    } catch (e: Exception) { null }

    private fun httpPost(urlStr: String, body: String): String? = try {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept", "application/json")
        conn.connectTimeout = 10_000; conn.readTimeout = 10_000
        conn.doOutput = true
        OutputStreamWriter(conn.outputStream).use { it.write(body) }
        if (conn.responseCode in 200..299) conn.inputStream.bufferedReader().readText() else null
    } catch (e: Exception) { null }

    private fun notify(title: String, text: String) {
        val mgr = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            mgr.createNotificationChannel(NotificationChannel(CHANNEL_ID, "JiJ Bot", NotificationManager.IMPORTANCE_DEFAULT))
        }
        mgr.notify(System.currentTimeMillis().toInt(), NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title).setContentText(text).setAutoCancel(true).build())
    }

    companion object {
        const val PROXY = "https://canadianpunkinvesting.com"
        const val JIJ_MINT = "14hACq5xFZQSeuXj8ggsTu8SmrBeUKZT13kPHeeTboop"
        const val SOL_MINT = "So11111111111111111111111111111111111111112"
        const val RPC = "https://rpc.ankr.com/solana"
        const val CHANNEL_ID = "jij_fills"
        val GRID_DENSITIES = intArrayOf(20, 40, 60)
    }
}
