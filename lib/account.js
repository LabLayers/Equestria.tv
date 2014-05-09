var db = require("./database");
var Q = require("q");

function Account(opts) {
    var defaults = {
        name: "",
        ip: "",
        aliases: [],
        globalRank: -1,
        channelRank: -1,
        guest: true,
        profile: {
            image: "",
            text: ""
        }
    };

    this.name = opts.name || defaults.name;
    this.lowername = this.name.toLowerCase();
    this.ip = opts.ip || defaults.ip;
    this.aliases = opts.aliases || defaults.aliases;
    this.globalRank = opts.globalRank || defaults.globalRank;
    this.channelRank = opts.channelRank || defaults.channelRank;
    this.effectiveRank = Math.max(this.globalRank, this.channelRank);
    this.guest = this.globalRank === 0;
    this.profile = opts.profile || defaults.profile;
}

module.exports.default = function (ip) {
    return new Account({ ip: ip });
};

module.exports.getAccount = function (name, ip, opts, cb) {
    if (!cb) {
        cb = opts;
        opts = {};
    }
    opts.channel = opts.channel || false;

    // TODO lookup profile
    var data = {};
    Q.fcall(function () {
        return Q.nfcall(db.users.getGlobalRank, name);
    }).then(function (globalRank) {
        data.globalRank = globalRank;
        return Q.nfcall(db.getAliases, ip);
    }).then(function (aliases) {
        data.aliases = aliases;
        if (opts.channel && opts.registered) {
            return Q.nfcall(db.channels.getRank, opts.channel, name);
        } else {
            if (opts.registered) {
                return 1;
            } else if (name) {
                return 0;
            } else {
                return -1;
            }
        }
    }).then(function (chanRank) {
        data.channelRank = chanRank;
        cb(null, new Account({
            name: name,
            ip: ip,
            aliases: data.aliases,
            globalRank: data.globalRank,
            channelRank: data.channelRank
        }));
    }).catch(function (err) {
        cb(err, null);
    }).done();
};

module.exports.rankForName = function (name, opts, cb) {
    if (!cb) {
        cb = opts;
        opts = {};
    }

    var rank = 0;
    Q.fcall(function () {
        return Q.nfcall(db.users.getGlobalRank, name);
    }).then(function (globalRank) {
        rank = globalRank;
        if (opts.channel) {
            return Q.nfcall(db.channels.getRank, opts.channel, name);
        } else {
            return globalRank > 0 ? 1 : 0;
        }
    }).then(function (chanRank) {
        cb(null, Math.max(rank, chanRank));
    }).catch(function (err) {
        cb(err, 0);
    }).done();
};

module.exports.rankForIP = function (ip, opts, cb) {
    if (!cb) {
        cb = opts;
        opts = {};
    }

    var globalRank, rank, names;

    var promise = Q.nfcall(db.getAliases, ip)
    .then(function (_names) {
        names = _names;
        return Q.nfcall(db.users.getGlobalRanks, names);
    }).then(function (ranks) {
        ranks.push(0);
        globalRank = Math.max.apply(Math, ranks);
        rank = globalRank;
    });

    if (!opts.channel) {
        promise.catch(function () {
            cb(err, null);
        }).done(function () {
            cb(null, globalRank);
        });
    } else {
        promise.then(function () {
            return Q.nfcall(db.channels.getRanks, opts.channel, names);
        }).then(function (ranks) {
            ranks.push(globalRank);
            rank = Math.max.apply(Math, ranks);
        }).catch(function () {
            cb(err, null);
        }).done(function () {
            cb(null, rank);
        });
    }
};