
export const optionsDefaultConfig:OptionsConfig = {
    transaction_message_delay: 5000,
    broadcast_message_delay:0
}

export interface OptionsConfig{
    transaction_message_delay:number

    broadcast_message_delay:number;
}
