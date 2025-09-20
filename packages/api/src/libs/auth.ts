import * as client from "openid-client"
import { skipSubjectCheck } from "openid-client";

const {
    OIDC_ISSUER,
    OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET,
    OIDC_REDIRECT_URI,
} = process.env;

if (!OIDC_ISSUER || !OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET || !OIDC_REDIRECT_URI) {
    throw new Error('Missing OpenID environment variables');
}

let redirectUri: string = OIDC_REDIRECT_URI;
let scope: string = 'openid profile email';

let clientAuth!: client.ClientAuth | undefined

let code_verifier: string = client.randomPKCECodeVerifier()
let code_challenge: string = await client.calculatePKCECodeChallenge(code_verifier)
let state!: string

let parameters: Record<string, string> = {
  redirect_uri: redirectUri,
  scope,
  code_challenge,
  code_challenge_method: 'S256',
}

export const createClient = async (issuer: string, client_id: string, client_secret: string) => {
    let config : client.Configuration = await client.discovery(
        new URL(issuer),
        client_id,
        client_secret,
        clientAuth,
        {
            execute: [client.allowInsecureRequests],
        }
    )

    return config
}

const config = await createClient(
    OIDC_ISSUER,
    OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET,
)

if (!config.serverMetadata().supportsPKCE()) {
  state = client.randomState()
  parameters.state = state
}

export const getLoginUrl = () => {
    let redirectTo: URL = client.buildAuthorizationUrl(config, parameters)
    return redirectTo.href
}

export const getToken = async (code: string) => {
    let tokenSet : client.TokenEndpointResponse = await client.genericGrantRequest(
        config,
        "authorization_code",
        {
            code,
            redirect_uri: redirectUri,
            code_verifier,
        }
    )
    return tokenSet
}

/*
(ノಠ益ಠ)ノ彡┻━┻
https://github.com/panva/openid-client/blob/main/docs/variables/skipSubjectCheck.md
*/
export const whoAmI = async (accessToken: string) => {
    let userinfo : client.UserInfoResponse = await client.fetchUserInfo(
        config,
        accessToken,
        skipSubjectCheck
    )
    return userinfo
}