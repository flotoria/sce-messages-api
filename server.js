const express = require("express");
const cors = require("cors");
const client = require("prom-client");

const app = express();
// middleware stuff
app.use(cors());
app.use(express.json());

// all data collected about server activity
let register = new client.Registry();

const currentRoomsOpen = new client.Gauge({
    name: "current_rooms_open",
    help: "Number of chatrooms currently open"
})

const totalMessagesSent = new client.Counter({
    name: "total_messages_sent",
    help: "Total number of messages sent"
})

const totalRoomsOpened = new client.Counter({ 
    name: "total_rooms_opened",
    help: "Total rooms opened"
})

const currentConnectionsOpen = new client.Gauge({
    name: "current_connections_open",
    help: "Total number of connections open"

})

const totalChatMessagesPerChatRoom = new client.Counter({ 
    name: "total_chat_messages_per_chatroom",
    help: "Total number of messages sent per chatroom",
    labelNames: ["id"]
})

register.registerMetric(currentRoomsOpen);
register.registerMetric(totalMessagesSent);
register.registerMetric(currentConnectionsOpen);
register.registerMetric(totalChatMessagesPerChatRoom);
register.registerMetric(totalRoomsOpened);

register.setDefaultLabels({
    app: 'messages-api'
})

client.collectDefaultMetrics({ register })

// clients and api key dictionary
const clients = {};
const apiKeys = {"key1": "Ryan", "key2": "Robert", "key3": "Liam"}; // dummy api keys for testing


// write function to write to the chatroom
function write(id, message) {
    if (clients[id]) {
        totalMessagesSent.inc();
        totalChatMessagesPerChatRoom.labels(id).inc();
        for (let res of clients[id]) {
            res.write(`data: ${message}\n\n`);
        }
    }
}

// api endpoint to send a message to everybody in the id chatroom
app.post("/send", (req, res) => {
    const { id, apiKey, message } = req.body;
    // invalid request if not enough body params
    if (!id || !apiKey || !message) {
        return res.status(400).send("Invalid request");  
    }
    // api key needs to be in the api keys dictionary
    else if (!Object.keys(apiKeys).includes(apiKey)) {
        return res.status(401).send("Unauthorized");
    }
    // write to everyone in the chatroom
    else {
        write(id, message);
        return res.status(200).send("OK");
    
    }
});

// sse request endpoint to listen to a specific chatroom and receive requests
app.get("/listen", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");

    const { apiKey, id } = req.query;

    // invalid request if not enough body params and end sse connection
    if (!apiKey || !id) {
        res.write("event: error\ndata: Invalid request\n\n");
        return res.end();
    }
    // if apikey does not exist end the response object and return unauthorized and end sse connection
    else if (!Object.keys(apiKeys).includes(apiKey)) {
        res.write("event: error\ndata: Unauthorized\n\n");
        return res.end();
    }
    else {
        // push the res object to the clients array corresponding to the chatroom id
        if (!clients[id]) {
            totalRoomsOpened.inc();
            currentRoomsOpen.inc();
            clients[id] = [];
            clients[id].push(res);
        }
        else {
            clients[id].push(res);
        }

        // add connection to the connections open gauge
        currentConnectionsOpen.inc();
    }

    // remove res object from chatroom when connection is closed 
    req.on('close', () => {
        clients[id] = clients[id].filter(client => client !== res);
        currentConnectionsOpen.dec();
        // delete chatroom if no clients are in it
        if (clients[id].length == 0) {
            currentRoomsOpen.dec();
            delete clients[id];
        }
    });
});

// to get prom metrics
app.get("/metrics", async (req, res) => {
    res.setHeader("Content-Type", register.contentType);
    res.end(await register.metrics());
})

// listen to port 5000 which is cool ig
app.listen(5000, () => {
    console.log("Server is running on port 5000");
})