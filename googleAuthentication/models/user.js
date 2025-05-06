const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const local = require('passport-local-mongoose');
const UserSchema = new Schema({
    email : {
        type : String,
        required : true
    },
    googleId: String
})

UserSchema.plugin(local);
const User = mongoose.model('User',UserSchema);
module.exports = User;
