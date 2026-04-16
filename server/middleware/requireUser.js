// Blocks access to a route if the requesting user is not logged in.
// WHY (Documentation + Code Style): Naming this function instead of leaving it anonymous
// makes stack traces and error logs much easier to read — you'll see "requireUser"
// instead of "anonymous". The description helps other developers quickly understand
// this middleware's role without reading through the full route chain.
export default async function requireUser(req, res, next) {
    if (!req.user) return res.status(401).send('Unauthorized')
    next()
}