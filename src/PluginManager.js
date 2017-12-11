const ProxyConfig = require(`./ProxyConfig`);
const Message = require(`../lib/Message`);
const NotificationCreateMessagePayload = require(`../lib/messagePayload/NotificationCreateMessagePayload`);
const TokenPayload = require(`../lib/TokenPayload`);
const AuthenticationPluginError = require(`../lib/errors/plugin/AuthenticationPluginError`);
const NotAuthorizedPluginError = require(`../lib/errors/plugin/NotAuthorizedPluginError`);
const NoPermissionsPluginError = require(`../lib/errors/plugin/NoPermissionsPluginError`);
const request = require(`request`);
const jwt = require('jsonwebtoken');
const debug = require(`debug`)(`pluginmanager`);


/**
 * Plugin manager class
 */
class PluginManager {

    static get PLUGIN_AUTHENTICATE_RESOURCE_PATH() { return `/token/plugin/authenticate`; }

    /**
     * Creates new PluginManager
     */
    constructor() {
        const me = this;

        me.pluginKeyTokenPayloadMap = new Map();

        if (me.isEnabled()) {
            debug(`Plugin Manager is enabled`);
        }
    }

    /**
     * Authenticates plugin with pluginKey by access token
     * @param pluginKey
     * @param token
     * @returns {Promise<any>}
     */
    authenticate(pluginKey, token) {
        const me = this;

        return new Promise((resolve, reject) => {
            request({
                method: `GET`,
                uri: `${ProxyConfig.AUTH_SERVICE_ENDPOINT}${PluginManager.PLUGIN_AUTHENTICATE_RESOURCE_PATH}?token=${token}`
            }, (err, response, body) => {
                try {
                    const authenticationResponse = JSON.parse(body);

                    if (!err && response.statusCode === 200) {
                        me.pluginKeyTokenPayloadMap.set(pluginKey, TokenPayload.normalize(jwt.decode(token).payload));

                        debug(`Plugin with key: ${pluginKey} has been authenticated`);

                        resolve(authenticationResponse);
                    } else {
                        debug(`Plugin with key: ${pluginKey} has not been authenticated`);

                        reject(new AuthenticationPluginError(authenticationResponse.message));
                    }
                } catch (error) {
                    reject(error.message);
                }
            });
        });
    }

    /**
     * TODO separate each check
     * Checks that plugin by pluginKey has permissions for operation
     * Throws next errors:
     *      - NotAuthorizedPluginError
     *      - NoPermissionsPluginError
     * @param pluginKey
     * @param message
     */
    checkConstraints(pluginKey, message) {
        const me = this;
        const isAuthenticated = me.isAuthenticated(pluginKey);

        if (!isAuthenticated &&
            message.type !== Message.PLUGIN_TYPE &&
            message.action !== Message.AUTHENTICATE_ACTION) {
            throw new NotAuthorizedPluginError(message);
        } else if (isAuthenticated === true) {
            const tokenPayload = me.getPluginTokenPayload(pluginKey);

            switch(message.type) {
                case Message.TOPIC_TYPE:
                    switch(message.action) {
                        case Message.CREATE_ACTION:
                            if (message.payload &&
                                (message.payload.length > 1 || message.payload[0] !== tokenPayload.topic)) {
                                throw new NoPermissionsPluginError(message);
                            }
                            break;
                        case Message.SUBSCRIBE_ACTION:
                        case Message.UNSUBSCRIBE_ACTION:
                            if (message.payload && message.payload.t &&
                                (message.payload.t.length > 1 || message.payload.t[0] !== tokenPayload.topic)) {
                                throw new NoPermissionsPluginError(message);
                            }
                            break;
                        case Message.LIST_ACTION:
                            throw new NoPermissionsPluginError(message);
                    }
                    break;
                case Message.NOTIFICATION_TYPE:
                    if (NotificationCreateMessagePayload.normalize(message.payload).topic !== tokenPayload.topic) {
                        throw new NoPermissionsPluginError(message);
                    }
                    break;
            }
        }
    }

    /**
     * Checks that plugin with pluginKey is authenticated
     * @param pluginKey
     * @returns {boolean}
     */
    isAuthenticated(pluginKey) {
        const me = this;

        return me.pluginKeyTokenPayloadMap.has(pluginKey);
    }

    /**
     * Removes authentication for plugin with pluginKey
     * @param pluginKey
     */
    removeAuthentication(pluginKey) {
        const me = this;

        me.pluginKeyTokenPayloadMap.delete(pluginKey);
    }

    /**
     * Returns plugin TokenPayload by pluginKey
     * @param pluginKey
     * @returns {TokenPayload}
     */
    getPluginTokenPayload(pluginKey) {
        const me = this;

        return me.pluginKeyTokenPayloadMap.get(pluginKey);
    }

    /**
     * Checking if Plugin Manager is enabled
     * @returns {boolean}
     */
    isEnabled() {
        return ProxyConfig.ENABLE_PLUGIN_MANGER === true;
    }
}


module.exports = PluginManager;