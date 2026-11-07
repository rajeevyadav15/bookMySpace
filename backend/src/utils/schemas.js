const { z } = require("zod");

const idParamSchema = z.object({
  id: z.uuid()
});

module.exports = { idParamSchema };