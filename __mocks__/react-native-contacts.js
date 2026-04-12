const Contacts = {
  getAll: jest.fn().mockResolvedValue([]),
  getContactById: jest.fn().mockResolvedValue(null),
  checkPermission: jest.fn().mockResolvedValue('authorized'),
  requestPermission: jest.fn().mockResolvedValue('authorized'),
};

module.exports = Contacts;
