import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { opentelemetry } from '@elysiajs/opentelemetry'

import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { PrismaInstrumentation } from '@prisma/instrumentation'

import { user } from './user'
import { post } from './post'

const app = new Elysia()
	.use(
		opentelemetry({
			instrumentations: [new PrismaInstrumentation()],
			spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())]
		})
	)
	.use(swagger())
	.use(user)
	.use(post)
	.get('/', ({ redirect }) => redirect('/swagger'))
	.get('/health', 'ok XD')
	.listen(3000)

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
