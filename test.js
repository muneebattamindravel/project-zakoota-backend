const bcrypt = require("bcrypt");

const hash = "$2b$10$qS/CqtDWdBLZuJR8g22VNOEkmP3vxwpLGOTp2eFAS8Pp3HyFV6Bbu";
bcrypt.compare("Mindravel@123!", hash).then(console.log);