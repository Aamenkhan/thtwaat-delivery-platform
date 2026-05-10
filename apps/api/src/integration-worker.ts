import './load-env.js'
import { integrationWorkerLoop } from './lib/queue/integration-jobs.js'

void integrationWorkerLoop()
