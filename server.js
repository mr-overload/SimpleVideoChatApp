const express = require('express')
const app = express()
const path = require('path');
const http = require('http').Server(app)
const io = require('socket.io')(http)
const port = process.env.PORT || 8080
const generateVideoLink = require('./utils').generateVideoLink;
const { SOCKET_TYPES } = require('./config');

var active_calls = {};

function connectCall(user_id, call_id) {
    if (!call_id) {
        call_id = generateVideoLink();
    }

    console.log("user connected : ", user_id, "->", call_id);

    if (!active_calls[call_id]) {
        active_calls[call_id] = { user_ids: {}, users: [] };
    }

    const call_users_len = active_calls[call_id].users.length;
    console.log("call_users_len : ", call_users_len);
    if (call_users_len > 2) {
        return { type: SOCKET_TYPES.SessionActive, call_id };
    }
    else {
        active_calls[call_id].user_ids[user_id] = user_id;
        active_calls[call_id].users.push({ user_id });

        if (call_users_len === 1) {
            return { type: SOCKET_TYPES.CreatePeer, call_id };
        }
    }
    return {};
}

function disconnectCall(user_id, call_id) {
    if (!call_id || !user_id) {
        return;
    }

    if (!active_calls[call_id]) {
        return;
    }

    console.log("user disconnected : ", user_id, "->", call_id);

    let active_call = active_calls[call_id];
    if (active_call.user_ids[user_id]) {
        delete active_call.user_ids[user_id];
    }
    let users = active_call.users.filter(user => user.user_id !== user_id);
    active_call.users = users;

    const call_users_len = active_calls[call_id].users.length;
    if (call_users_len === 0) {
        delete active_calls[call_id];
    }
    else {
        return { type: SOCKET_TYPES.Disconnect };
    }
}

function setCookie(call_id, res) {
    res.cookie('call_id', call_id);
    res.redirect('http://localhost:3000');
    // res.sendFile(path.join(__dirname, 'public') + '/index.html');
}

app.get('/call', function (req, res) {
    var call_id = generateVideoLink();

    // res.redirect('/');
    // res.sendFile(path.join(__dirname, 'public') + '/index.html');
    setCookie(call_id, res);
});

app.get('/call/:id', function (req, res) {
    var call_id = req.params.id;

    if (!call_id) {
        call_id = generateVideoLink();
    }

    // res.redirect('/');
    // res.sendFile(path.join(__dirname, 'public') + '/index.html');
    setCookie(call_id, res);
});

app.use(express.static(__dirname + "/public"));

io.on('connection', function (socket) {
    socket.on(SOCKET_TYPES.NewClient, function (data) {
        console.log("data : ", data);
        const { user_id, call_id } = data;
        const connect = connectCall(user_id, call_id);
        console.log("connect : ", connect);
        if (connect.type) {
            setTimeout(() => {
                console.log("emitting : ", connect.type, (new Date()).valueOf());
                this.emit(connect.type, { call_id: connect.call_id });
            }, 500);
        }
    });

    socket.on(SOCKET_TYPES.Offer, SendOffer)
    socket.on(SOCKET_TYPES.Answer, SendAnswer)
    socket.on('my_disconnect', MyDisconnect);
    socket.on(SOCKET_TYPES.disconnect, Disconnect)
})

function MyDisconnect(data) {
    console.log("inside MyDisconnect data : ", data);

    Disconnect(data);
}

function Disconnect(data) {
    console.log("inside Disconnect data : ", data);
    const { user_id, call_id } = data;

    console.log("inside Disconnect : ", user_id, "->", call_id);

    disconnectCall(user_id, call_id);
}

function SendOffer(offer) {
    console.log("inside SendOffer");
    this.broadcast.emit(SOCKET_TYPES.BackOffer, offer)
}

function SendAnswer(data) {
    console.log("inside SendAnswer");
    this.broadcast.emit(SOCKET_TYPES.BackAnswer, data)
}

http.listen(port, () => console.log(`Active on ${port} port`))
