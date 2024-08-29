
import express, { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import { Socket } from 'net';
import morgan from 'morgan';

import { configDotenv } from 'dotenv';

import handler from './hanlder'

configDotenv({ path: ['.env', '.env.local'] });

const app = express();

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// main handler

app.use('all', handler)

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
    console.log(`\n🚀 Fn is listening on port ${port}\n`);
});

let connections: Socket[] = [];

server.on('connection', connection => {
    connections.push(connection);
    connection.on('close', () => connections = connections.filter(curr => curr !== connection));
});

// setInterval(() => server.getConnections(
//     (err, connections) => console.log(`${connections} connections currently open`)
// ), 1000);

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

function shutDown() {
    console.log('Received kill signal, shutting down gracefully');
    server.close(() => {
        console.log('Closed out remaining connections');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);

    console.log(`${connections.length} connections currently open`)
    connections.forEach(curr => curr.end());
    setTimeout(() => connections.forEach(curr => curr.destroy()), 5000);
}

// export function index(req, res) {
//     res.send('index from server.js');
// }