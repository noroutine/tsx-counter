import { NextFunction } from 'express';
import { Session } from './objects/session';
import { Counter } from "./objects/counter";

import { convertYesToBoolean, generateRandomAlphanumeric, isAbsoluteURL } from "./utils";
import { SecureSession } from './session';
import ViewFactory from './views';
import { buildRbac } from './rbac/counters_rbac';
import { Permission, RBAC, ResourceId, Subscription } from './rbac/rbac';
import { DurableObjectInventory } from './durableobjectinventory';
import { getSubscription } from './subscription';

const NAMESPACE_ID = "system";

export default {
  /**
   * This is the standard fetch handler for a Cloudflare Worker
   *
   * @param request - The request submitted to the Worker from the client
   * @param env - The interface to reference bindings declared in wrangler.toml
   * @param ctx - The execution context of the Worker
   * @returns The response to be sent back to the client
   */
  async handler(request: Request, response: Response, next: NextFunction) {
    let url = new URL(request.url);

    // Get the base URL (URL without path)
    const baseUrl = url.port ? `${url.protocol}//${url.hostname}:${url.port}` : `${url.protocol}//${url.hostname}`

    // determine if we are in dash
    let dashMode = process.env.DASH == url.hostname;
    // determine god mode
    let godMode =
      (process.env.GOD_MODE == "never" && false) ||
      (process.env.GOD_MODE == "dash" && dashMode) ||
      (process.env.GOD_MODE == "always");

    let subscription = getSubscription(url.hostname)

    // subscription specific object inventory
    let countersInventory = new DurableObjectInventory(Counter.INVENTORY_ID, env.INVENTORY, env.COUNTERS, subscription, NAMESPACE_ID, Counter.RESOURCE_TYPE)
    let sessionsInventory = new DurableObjectInventory(Session.INVENTORY_ID, env.INVENTORY, env.SESSIONS, subscription, NAMESPACE_ID, Session.RESOURCE_TYPE)

    // construct view factory
    const VIEW_FACTORY = new ViewFactory()

    // now to business
    // Fuck off
    if (url.pathname === "/favicon.ico") {
      return VIEW_FACTORY.notFound();
    }

    // if we come home - go to counters
    if (url.pathname === "/") {
      return Response.redirect(`${baseUrl}/-/counters/`, 302)
    }

    if (url.pathname === "/-/") {
      return Response.redirect(`${baseUrl}/-/counters/`, 302)
    }

    // public fast path handler 
    if (!url.pathname.startsWith('/-/')) {
      // fast track performance counters
      let startTime = performance.now()
      
      let slug = decodeURI(url.pathname).split(/\//)[1]
      let slugCounterId = await countersInventory.getObjectFromSimpleName(slug);
      await slugCounterId.increment(1)
      let redirectUrl: string = await slugCounterId.getDataUrl()
      
      console.log(`Request time (fast track) for ${url.pathname} is ${(performance.now() - startTime).toFixed(2)}ms`)

      if (redirectUrl == "/" || redirectUrl.length == 0 || redirectUrl == undefined) {
        return VIEW_FACTORY.pixel();
      } else if (isAbsoluteURL(redirectUrl)) {
        return Response.redirect(redirectUrl, 302)
      } else {
        // relative and not "/"
        return Response.redirect(baseUrl + redirectUrl, 302)
      }
    }

    // determine tracking pixel
    let trackerName = convertYesToBoolean(process.env.TRACKER) && !dashMode ? url.hostname : '';

    // handle session
    let session = await SecureSession.fromRequest(request, sessionsInventory);

    if (godMode) {
      session.transcend()

      // in god mode, allow to supply and override subscription name
      // check url param
      let subscriptionOverride = url.searchParams.get("subscription");
      // and check session data
      if (!subscriptionOverride && session.encryptedData) {
        try {
          subscriptionOverride = JSON.parse(session.encryptedData).subscriptionOverride
        } catch {

        }        
      }

      if (subscriptionOverride && subscription.id != subscriptionOverride) {
        subscription = getSubscription(subscriptionOverride)

        // store it in session
        session.encryptedData = JSON.stringify({ subscriptionOverride: subscription.id })
        
        // load and recreate inventory
        countersInventory = new DurableObjectInventory(Counter.INVENTORY_ID, env.INVENTORY, env.COUNTERS, subscription, NAMESPACE_ID, Counter.RESOURCE_TYPE)
        sessionsInventory = new DurableObjectInventory(Session.INVENTORY_ID, env.INVENTORY, env.SESSIONS, subscription, NAMESPACE_ID, Session.RESOURCE_TYPE)
      } else {
        // clean any overrides from session
        // this should be better
        session.encryptedData = ""
      }
    }

    console.log(`God Mode: ${process.env.GOD_MODE},${session.god}, dash: ${process.env.DASH}, baseUrl: ${baseUrl}`);

    // Initialize RBAC with default roles
    const rbac = buildRbac()

    // names.forEach(name => {
    //   ['increment', 'read', 'delete'].forEach(action => {
    //     if (canDo(session, rbac, action, name)) {
    //       console.log(`🟢 ${session.principal.id} can ${action} ${name}`)
    //     } else {
    //       console.log(`🔴 ${session.principal.id} cannot ${action} ${name}`)
    //     }
    //   })
    // })

    // dash guard, only counters view and counters increment are allowed outside dash
    if (!session.god && !["/", "/-/counters/", "/-/counters/increment"].includes(url.pathname)) {
      return Response.redirect(`https://${process.env.DASH}`, 302)
    }

    let names = await countersInventory.getResourceNames();
    let sessions = await sessionsInventory.getResourceNames();

    if (url.pathname.startsWith("/-/counters/")) {
      let name = url.searchParams.get("name");

      // if no name given - return view without creating DO instance
      if (!name) {
        return VIEW_FACTORY.createCounterView(session, names, sessions, generateRandomAlphanumeric(8, true), 0, "/", trackerName);
      }
  
      let counterStub: DurableObjectStub<Counter> = await countersInventory.getObjectFromSimpleName(name);

      let count = await counterStub.getCounterValue();
      let dataUrl = await counterStub.getDataUrl();
  
      switch (url.pathname) {
        case "/-/counters/":
          return VIEW_FACTORY.createCounterView(session, names, sessions, name, count, dataUrl, trackerName);
        case "/-/counters/increment":
          await counterStub.increment(1);
          break;
        case "/-/counters/decrement":
          await counterStub.decrement(1);
          break;
        case "/-/counters/update":
          await counterStub.updateData(url.searchParams.get("url") || "/");
          break;
        case "/-/counters/delete":
          await countersInventory.deleteObjectBySimpleName(name);
          return Response.redirect(`${baseUrl}/-/counters/`, 302);
        case "/-/counters/trace":
          return VIEW_FACTORY.createTraceView(session, await counterStub.trace());
        default:
          return VIEW_FACTORY.notFound();
      }

      return Response.redirect(`${baseUrl}/-/counters/?name=${name}`, 302);
    }

    if (url.pathname.startsWith("/-/sessions/")) {
      let sessionName = url.searchParams.get("name");

      if (!sessionName) {
        return VIEW_FACTORY.createSessionsView(session, sessions, session.id);
      }

      if (!sessions.includes(sessionName)) {
        return Response.redirect(`${baseUrl}/-/sessions/`, 302);
      }

      switch (url.pathname) {
        case "/-/sessions/":
          return VIEW_FACTORY.createSessionsView(session, sessions, sessionName || session.id);
        case "/-/sessions/delete":
          if (sessionName) {
            await sessionsInventory.deleteObjectBySimpleName(sessionName);
          }
          return Response.redirect(`${baseUrl}/-/sessions/`, 302);
        default:
          return VIEW_FACTORY.notFound();
      }
    }

    if (url.pathname.startsWith("/-/cleanup")) {
      console.log('Triggering cleanup')

      // for (let i = 0; i < Math.min(50, sessions.length); i++) {
      //   let sessionId = sessions[i];
      //   await sessionsInventory.deleteObjectBySimpleName(sessionId);
      //   console.log('Deleted session', sessionId)
      // }

      return VIEW_FACTORY.TextResponse(session, `Nothing here`)
    }

    return VIEW_FACTORY.notFound();
  }
};

function canDo(session: SecureSession, rbac: RBAC, action: string, counterName: string): boolean {
  const permission: Permission = { 
    action,
    tenantId: 'noroutine',
    subscriptionId: '*',
    namespaceId: 'system',
    resourceTypeId: 'counter',
    resourceId: counterName,
    effect: 'allow'
  };

  const resourceId: ResourceId = {
    tenantId: 'noroutine',
    subscriptionId: 'system',
    namespaceId: 'system',
    resourceTypeId: 'counter',
    resourceId: counterName
  }

  return rbac.hasPermission(session.principal.id, permission, resourceId, null)
}