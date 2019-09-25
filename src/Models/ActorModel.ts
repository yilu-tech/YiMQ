import nohm from "nohm";

export const ActorModel = nohm.model('User', {
    properties: {
      name: {
        type: 'string',
        unique: true,
        validations: ['notEmpty'],
      },
      key: {
        type: 'string',
        validations: ['notEmpty'],
      },
      api: {
        type: 'string',
        validations: ['notEmpty'],
      },
      status: {
        type: 'integer'
      }
    }
  });


