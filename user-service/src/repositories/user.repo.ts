import { JsonDatabase } from '../../../shared/JsonDatabase';
import type { User } from '../models/user.models';

const db = new JsonDatabase<User>('./data/users.json');

export const readUsers = () => db.read();
export const writeUsers = (data: User[]) => db.write(data);
