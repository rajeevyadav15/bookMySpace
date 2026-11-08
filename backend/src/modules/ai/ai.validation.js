const { z } = require("zod");

// Server keeps no chat memory. Client sends the recent messages each time.
const chatSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(2000),
        })
      )
      .min(1)
      .max(20),
  })
  .refine((d) => d.messages[0].role === "user", {
    message: "First message must be from user",
    path: ["messages"],
  })
  .refine((d) => d.messages[d.messages.length - 1].role === "user", {
    message: "Last message must be from user",
    path: ["messages"],
  });

module.exports = { chatSchema };