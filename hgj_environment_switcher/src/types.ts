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

export interface subAccount {
    companyId: string
    enterpriseAddress: string
    enterpriseId: string
    enterpriseName: string
    expireTime: string
    isAudit: number
    isCorp: number
    isCorpRoot: number
    isSaas: number
    state: number
    systemRole: number
}

export interface Account {
    account: string
    password: string
    env: Env | undefined
    userId: string
    subAccount: subAccount[]
    defaultSubAccount?: subAccount
}
