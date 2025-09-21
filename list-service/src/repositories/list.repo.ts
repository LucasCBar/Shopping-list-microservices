import { JsonDatabase } from '../../../shared/JsonDatabase';
import type { ShoppingList } from '../models/list.model';

const db = new JsonDatabase<ShoppingList>('./data/lists.json');

export const readLists = () => db.read();
export const writeLists = (data: ShoppingList[]) => db.write(data);
