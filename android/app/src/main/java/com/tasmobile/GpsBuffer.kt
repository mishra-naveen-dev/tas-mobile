package com.tasmobile

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * Durable FIFO of unsent GPS fixes (one JSON string per row), oldest first.
 *
 * Replaces the SharedPreferences buffer, which rewrote the whole backlog on
 * every fix and so had to stay small (600 fixes, ~2 h offline). A row insert
 * costs the same at 20,000 rows as at 1, so a 2-day offline stretch fits.
 * Ids only grow and rows only leave from the front, so "id <= x" is always
 * "the oldest rows up to x". SQLiteDatabase serializes access across threads.
 */
class GpsBuffer(context: Context) :
    SQLiteOpenHelper(context, "gps_buffer.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE points (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    /** Appends a fix; returns how many fixes were dropped from the front to stay within [cap]. */
    fun add(json: String, cap: Int): Int {
        val db = writableDatabase
        val id = db.insert("points", null, ContentValues().apply { put("json", json) })
        return db.delete("points", "id <= ?", arrayOf((id - cap).toString()))
    }

    fun count(): Long = android.database.DatabaseUtils.queryNumEntries(readableDatabase, "points")

    /** The oldest [limit] fixes as (id, json). */
    fun oldest(limit: Int): List<Pair<Long, String>> =
        readableDatabase.query("points", arrayOf("id", "json"), null, null, null, null, "id", limit.toString())
            .use { c -> List(c.count) { c.moveToNext(); c.getLong(0) to c.getString(1) } }

    /** Removes every fix up to and including [id] (confirmed stored by the server). */
    fun deleteUpTo(id: Long) {
        writableDatabase.delete("points", "id <= ?", arrayOf(id.toString()))
    }

    fun clear(): Int = writableDatabase.delete("points", null, null)
}
