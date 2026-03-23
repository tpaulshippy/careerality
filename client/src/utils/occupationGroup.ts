const socToOOHGroup: Record<string, string> = {
  '11': 'Management',
  '13': 'Business and Financial',
  '17': 'Architecture and Engineering',
  '21': 'Community and Social Service',
  '23': 'Legal',
  '25': 'Education Training and Library',
  '29': 'Healthcare',
  '31': 'Healthcare',
  '33': 'Protective Service',
  '35': 'Food Preparation and Serving',
  '37': 'Building and Grounds Cleaning',
  '39': 'Personal Care and Service',
  '41': 'Sales',
  '43': 'Business and Financial',
  '45': 'Farming Fishing and Forestry',
  '47': 'Construction and Extraction',
  '49': 'Installation Maintenance and Repair',
  '51': 'Production',
  '53': 'Transportation and Material Moving',
  '55': 'Military',
  '19': 'Life Physical and Social Science',
};

const socMinorToOOHGroup: Record<string, string> = {
  '15-12': 'Computer and Information Technology',
  '15-20': 'Math',
  '27-10': 'Arts and Design',
  '27-20': 'Entertainment and Sports',
  '27-30': 'Media and Communication',
};

export function getOccupationGroup(socCode: string): string {
  const minor = socCode.substring(0, 5);
  if (socMinorToOOHGroup[minor]) {
    return socMinorToOOHGroup[minor];
  }

  const major = socCode.substring(0, 2);
  return socToOOHGroup[major] ?? 'Management';
}
