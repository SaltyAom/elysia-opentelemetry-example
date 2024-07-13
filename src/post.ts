import { Elysia, t } from 'elysia'
import { validateSession } from './user'
import { prisma } from './utils'

export const post = new Elysia({ tags: ['post'], prefix: 'post' })
	.get(
		':page',
		({ params: { page } }) =>
			prisma.post.findMany({
				take: 25,
				skip: 25 * (page - 1),
				orderBy: {
					createdAt: 'desc'
				}
			}),
		{
			params: t.Object({
				page: t.Number({
					minimum: 1
				})
			})
		}
	)
	.use(validateSession)
	.get(
		'my/:page',
		({ userId, params: { page } }) =>
			prisma.post.findMany({
				take: 25,
				skip: 25 * (page - 1),
				where: {
					authorId: userId
				}
			}),
		{
			params: t.Object({
				page: t.Number()
			})
		}
	)
	.put(
		'',
		async ({ body, userId }) => {
			try {
				const post = await prisma.post.create({
					data: {
						...body,
						authorId: userId
					}
				})

				return {
					success: true,
					message: 'Post created',
					post
				}
			} catch {
				return {
					success: false,
					message: 'An error occurred'
				}
			}
		},
		{
			body: t.Object({
				title: t.String(),
				content: t.String()
			})
		}
	)
	.patch(
		':id',
		async ({ body, userId, params: { id }, error }) => {
			const post = await prisma.post.findUnique({
				where: {
					id
				},
				select: {
					authorId: true
				}
			})

			if (post?.authorId !== userId)
				return error(401, {
					success: false,
					message: 'Unauthorized'
				})

			const newPost = await prisma.post.update({
				data: {
					...body,
					updatedAt: new Date(),
					authorId: userId
				},
				where: {
					id,
					authorId: userId
				}
			})

			return {
				success: true,
				message: 'Post updated',
				post: newPost
			}
		},
		{
			body: t.Partial(
				t.Object({
					title: t.String(),
					content: t.String()
				})
			)
		}
	)
