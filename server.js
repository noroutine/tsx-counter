import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import morgan from 'morgan';
import { glob } from 'glob';
import path from 'path';

import { configDotenv } from 'dotenv';
configDotenv({ path: ['.env', '.env.local'] });

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var fnRoutes = []

var unlessFunction = function (middleware) {
    return function (req, res, next) {
        if (fnRoutes.includes(req.path)) {
            return next();
        } else {
            return middleware(req, res, next);
        }
    };
};

const yes = /^(1|true|yes|on)$/i;

const FALLBACK_UPSTREAM = process.env.FALLBACK_UPSTREAM || null;
const FALLBACK_UPSTREAM_INDEX_PATH_REWRITE = yes.test(process.env.FALLBACK_UPSTREAM_INDEX_PATH_REWRITE) ? { '/$': '/index.html' } : undefined;

if (FALLBACK_UPSTREAM) {
    console.log(`Using fallback upstream: ${FALLBACK_UPSTREAM}, index path rewrite: ${FALLBACK_UPSTREAM_INDEX_PATH_REWRITE ? 'enabled' : 'disabled'}`);
    
    app.use(unlessFunction(
        createProxyMiddleware(
            {
                target: process.env.FALLBACK_UPSTREAM,
                changeOrigin: true,
                pathRewrite: FALLBACK_UPSTREAM_INDEX_PATH_REWRITE
            }
        )
    ));
}

const port = process.env.PORT || 3000;

async function loadRoutesFromFile(app, file) {
    var mod = await import(path.resolve(file))
    console.log(`Importing ${file}`);
    Object.entries(mod).forEach(([key, value]) => {
        console.log(`  ...checking ${key} [${typeof value}]`);
        if (typeof value === 'function') {
            // construct the route to function
            var route = `/${path.dirname(file)}/${key}`.replace(/^\/\.\//, '/');

            // handle main and index functino specially
            if (key == "main" || key == "index") {
                route = route.replace(/\/(main|index)$/, '/');
            }

            app.all(route, value);

            fnRoutes.push(route);
            console.log(`  ✅ installed ${route} => ${key}`);
        } else {
            console.log(`     ignored ${key} [${typeof value}]`);
        }
    });
}


const server = app.listen(port, async () => {
    for (const file of glob.sync('./**/*.js', { ignore: "./node_modules/**" })) {
        await loadRoutesFromFile(app, file)
    }
    console.log(`\n🚀 All routes loaded and Fn is listening on port ${port}\n`);
})

let connections = [];

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