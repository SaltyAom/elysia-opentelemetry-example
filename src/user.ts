import { Elysia, t } from 'elysia'
import { prisma } from './utils'
import { randomBytes } from 'crypto'
import { safeExecuteInTheMiddle } from '@opentelemetry/instrumentation'

export const validateSession = new Elysia()
	.model({
		session: t.Cookie({
			session: t.Optional(t.String())
		}),
		response: t.Object({
			success: t.Boolean(),
			message: t.String()
		})
	})
	.guard({
		response: {
			401: 'response'
		}
	})
	.derive(
		{ as: 'scoped' },
		async function getUserIdFromSession({ cookie: { session }, error }) {
			if (!session.value)
				return error(401, {
					success: false,
					meesage: 'Unauthorized'
				})

			const data = await prisma.session.findFirst({
				where: {
					id: session.value
				},
				select: {
					userId: true,
					expiresAt: true
				}
			})

			if (!data?.userId)
				return error(401, {
					success: false,
					meesage: 'Unauthorized'
				})

			if (!data.expiresAt || data.expiresAt < new Date()) {
				session.remove()

				// Delete expired session
				setImmediate(() => {
					prisma.session.delete({
						where: {
							id: session.value
						}
					})
				})

				return error(401, {
					success: false,
					message: 'Session expired'
				})
			}

			return {
				userId: data?.userId
			}
		}
	)

export const user = new Elysia({
	tags: ['user'],
	prefix: 'user',
	cookie: {
		httpOnly: true
	}
})
	.model({
		response: t.Object({
			success: t.Boolean(),
			message: t.String()
		}),
		session: t.Cookie({
			session: t.Optional(t.String())
		})
	})
	.post(
		'sign-in',
		async ({
			body: { username, password },
			cookie: { session },
			error
		}) => {
			const user = await prisma.user.findFirst({
				where: {
					name: username
				},
				select: {
					id: true,
					salt: true,
					password: true
				}
			})

			if (!user)
				return error(401, {
					success: false,
					message: 'Incorrect username or password'
				})

			const isVerified = await Bun.password.verify(
				password + user.salt,
				user.password
			)

			if (!isVerified)
				return error(401, {
					success: false,
					message: 'Incorrect username or password'
				})

			const { id } = await prisma.session.create({
				data: {
					userId: user.id,
					// Expires in 90 days
					expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90)
				},
				select: {
					id: true
				}
			})

			session.value = id

			return { success: true, message: 'Signed in' }
		},
		{
			body: t.Object({
				username: t.String(),
				password: t.String({
					minLength: 8
				})
			}),
			response: {
				200: 'response',
				401: 'response'
			},
			cookie: 'session'
		}
	)
	.put(
		'sign-up',
		async ({ body: { username, password }, error }) => {
			const user = await prisma.user.findFirst({
				where: {
					name: username,
					password
				},
				select: {
					id: true
				}
			})

			if (user)
				return error(401, {
					success: false,
					message: 'User already exists'
				})

			const salt = randomBytes(32).toString('hex')

			const hash = await Bun.password.hash(password + salt, {
				algorithm: 'argon2id',
				memoryCost: 4,
				timeCost: 3
			})

			await prisma.user.create({
				data: {
					name: username,
					password: hash,
					salt
				},
				select: null
			})

			return { success: true, message: 'User created' }
		},
		{
			body: t.Object({
				username: t.String(),
				password: t.String({
					minLength: 8
				})
			}),
			response: {
				200: 'response',
				401: 'response'
			}
		}
	)
	.get(
		'sign-out',
		({ cookie: { session } }) => {
			session.remove()

			return {
				success: true,
				message: 'Signed out'
			}
		},
		{
			response: 'response'
		}
	)
	.use(validateSession)
	.get('profile', ({ userId }) =>
		prisma.user.findFirst({
			where: {
				id: userId
			},
			select: {
				name: true
			}
		})
	)
