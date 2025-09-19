export type Position = {
    x: number
    y: number
}

export type Env = 'dev' | 'beta' | 'prod'

export enum EnvTagType {
    dev = 'info',
    beta = 'warning',
    prod = 'success'
}

export type Account = {
    name: string
    account: string
    password: string
    env: Env[]
    id?: string
}
