// src/models/command.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const commandSchema = new mongoose.Schema(
  {
    commandId: {
      type: String,
      unique: true,
      default: uuidv4, // ✅ always generate a new UUID
    },
    deviceId: { type: String, required: true, index: true },

    // Target: service or client
    target: {
      type: String,
      enum: ["client", "service"],
      required: true,
    },

    // Command type depending on target
    type: {
      type: String,
      required: true,
      enum: [
        // service commands
        "restart-service",
        "restart-client",
        // client commands
        "show-popup",
        "focus-hours-start",
        "focus-hours-end",
        "hide",
        "refresh",
        "lock",
        "requires-update",
      ],
    },

    payload: { type: Object, default: {} },

    status: {
      type: String,
      enum: ["pending", "acknowledged"],
      default: "pending",
    },
    acknowledgedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Command", commandSchema);
