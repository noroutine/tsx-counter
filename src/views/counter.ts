import { Subscription } from '../rbac/rbac';
import { SecureSession } from './../session';

function ifGod(str: string, godMode: boolean): string {
    return godMode ? str : "";
}

export function CounterView(session: SecureSession, names: string[], sessions: string[], subscriptions: Subscription[], subscriptionOverride: Subscription | undefined, name: string = "", count: number = 0, dataUrl: string = "/", godMode: boolean = false, tracker: string = ''): string {
    let countSnippet = "";
    if (name) {
        countSnippet = `<p>Count: ${count}</p>`;
    }

    let namesList = names.map(name =>
        `<li style="margin: 0.5em">` +
        `<a class="op-link" href="/-/counters/?name=${name}">⚙️</a>` +
        `<a class="op-link" href="/-/counters/increment?name=${name}">➕</a>` +
        ifGod(`<a class="op-link" href="/-/counters/decrement?name=${name}">➖</a>`, godMode) +
        ifGod(`<a class="op-link" href="/-/counters/trace?name=${name}">🔎</a>`, godMode) +
        ifGod(`<a class="op-link op-danger" style="" href="/-/counters/delete?name=${name}">❌</a>`, godMode) +
        `<a class="op-link" href="/${name}">🔗</a>` +
        `<a class="op-link copy-link" href="/${name}">📑</a>` +
        `<span style="margin-left: 1em;"><code>${name}</code></span>` +
        `<span class="name-message"></span>` +
        `</li>`
    ).join('')

    let sessionsList = sessions.map(name =>
        `<li style="margin: 0.5em">` +
        `<a href="/-/sessions/?name=${name}" style="margin-left: 1em;"><code>${name}</code></a>` +
        `</li>`
    ).join('')

    let subscriptionsList = subscriptions.map(s =>
        `<li style="margin: 0.5em">` +
        `<a href="/-/counters/?subscription=${s.id}" style="margin-left: 1em;"><code>${s.name}</code></a>` +
        `</li>`
    ).join('')

    let countersSnippet = names.length > 0 ? `<p>Known counters:<ul style="list-style: none; padding-left: 0;">${namesList}</ul></p>` : `<p>No counters yet</p>` ;
    let currentSessionSnippet = `<p>Session ID: <code>${session.id}</code>, <code>${session.persisted ? 'Persisted' : 'Ephemeral' }</code></p>`
    let currentSubscriptionSnippet = `<p>Subscription ID: <code>${session.subscription.id}</code>, Name: <code>${session.subscription.name}</code></p>`
    let overrideSubscriptionSnippet = subscriptionOverride ? `<p>Subscription Override ID: <code>${subscriptionOverride.id}</code>, Name: <code>${subscriptionOverride.name}</code></p>` : ''
    let sessionsListSnippet = sessions.length > 0 ? `<p><a href="/-/sessions/">Known persisted sessions</a>: <ul style="list-style: none; padding-left: 0;">${sessionsList}</ul></p>` : `<p>No persisted sessions</p>`
    let subscriptionsListSnippet = `<p>Subscriptions: <ul style="list-style: none; padding-left: 0;">${subscriptionsList}</ul></p>`
    let performanceSnippet = `<p>Request performance: <code>${(performance.now() - session.startTime).toFixed(2)}ms</code></p>`

    let pixel = (tracker) ? `<img src="https://nrtn.me/${tracker}" />`: '';

    return `<!DOCTYPE html>
<html>
<head>
    <title>Counters</title>
    <style>
        body {
            font-family: Arial, sans-serif;
        }
        form {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        input[type="text"] {
            width: 200px;
            padding: 10px;
            margin-right: 0.5em;
            margin-left: 0.5em;
            border: 1px solid #ddd;
            border-radius: 4px;
        }

        .btn {
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .btn:hover {
            background-color: #45a049;
            transform: translateY(-2px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        input[type="submit"].btn-danger {
            background-color: #dc3545;
        }

        input[type="submit"].btn-danger:hover {
            background-color: #c82333;
        }

        .op-link {
            text-decoration: none;
            // margin-left: 0.3em;
            padding: 8px;
            border-radius: 8px;
        }

        .op-link:hover {
            transform: translateY(-2px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        // .op-danger {
        //     margin-left: 1em;
        //     margin-right: 1em;
        // }

        .copy-link.clicked {
            // background-color: #28a745;
            transform: scale(0.95);
        }
        .name-message {
            margin-left: 1rem;
            font-weight: bold;
            // height: 1.5em;
        }
    </style>
</head>
<body>
    <h1><a href="/-/">Home</a> :: <a href="/-/counters/">Counters</a></h1>
    <p>Select a Durable Object to contact by using the <code>name</code> URL query string parameter, for example, <code>?name=A</code></p>
    <p>Controls below will do exactly that for you</p>
    <form action="/" method="get">
        <label for="name">Name:</label><input type="text" id="name" name="name" value="${name}" />
        ${ifGod(`<label for="url">URL:</label><input type="text" id="url" name="url" value="${dataUrl}" />`, godMode)}
        <input id="increment" type="submit" class="btn" formaction="/-/counters/increment" value="Increment" />
        ${ifGod(`<input id="decrement" type="submit" class="btn" formaction="/-/counters/decrement" value="Decrement">`, godMode)}
        ${ifGod(`<input id="update" type="submit" class="btn" formaction="/-/counters/update" value="Update">`, godMode)}
        ${ifGod(`<input id="trace" type="submit" class="btn" formaction="/-/counters/trace" value="Trace" />`, godMode)}
        ${ifGod(`<input id="delete" type="submit" class="btn btn-danger" formaction="/-/counters/delete" value="Delete" />`, godMode)}
        ${countSnippet}
    </form>

    ${countersSnippet}
    ${currentSessionSnippet}
    ${currentSubscriptionSnippet}
    ${performanceSnippet}
    ${ifGod(overrideSubscriptionSnippet, godMode)}
    ${ifGod(sessionsListSnippet, godMode)}
    ${ifGod(subscriptionsListSnippet, godMode)}

    <script>
        // Function to copy link to clipboard
        function copyLinkToClipboard(link, messageElement) {
            navigator.clipboard.writeText(link)
                .then(() => {
                    console.log('Link copied to clipboard successfully!');
                    messageElement.textContent = 'Link copied successfully!';
                    setTimeout(() => {
                        messageElement.textContent = '';
                    }, 1000);
                })
                .catch(err => {
                    console.error('Failed to copy link: ', err);
                    messageElement.textContent = 'Failed to copy link.';
                });
        }

        // Add click event listeners to all elements with class 'copy-link'
        document.querySelectorAll('.copy-link').forEach(link => {
            // console.log(link)
            link.addEventListener('click', function(event) {
                event.preventDefault(); // Prevent the default action of following the link
                const linkToCopy = this.href; // Get the href attribute of the clicked link
                const messageElement = this.parentNode.querySelector('.name-message');
                
                // Add visual feedback
                this.classList.add('clicked');
                
                // Remove the 'clicked' class after a short delay
                setTimeout(() => {
                    this.classList.remove('clicked');
                }, 300);

                copyLinkToClipboard(linkToCopy, messageElement);
            });
        });
    </script>
    ${pixel}
</html>
`;
};